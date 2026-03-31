import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { UserProvider } from "#providers/userProvider";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";
import mongoose from "mongoose";
import dayjs from "dayjs";

export default (_express: Application) => {
	const examProvider = new ExamProvider();
	const userProvider = new UserProvider();
	const examParticipantProvider = new ExamParticipantProvider();
	return <Resource>{
		put: {
			middleware: verify,
			handler: async (req: Req<any>, res: Res) => {
				/**
				 * @openapi
				 * /user/exam/{exam_id}/begin:
				 *   put:
				 *     tags: [User]
				 *     description: Begin an exam
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: exam_id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam ID
				 *         required: true
				 *     requestBody:
				 *       description: Optional template selection
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             properties:
				 *               template_id:
				 *                 type: string
				 *                 description: Template ID to select (optional, random if not provided)
				 *           example:
				 *             template_id: "69ca4d16cc523335772b55ee"
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					const currentTime = new Date();
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);

					const examId = req.params.exam_id as string;
					const exam = await examProvider.validateAndFetchExam(examId);

					if (currentTime < exam.start_time) throw new Error("Kỳ thi chưa diễn ra");
					if (currentTime > exam.end_time) throw new Error("Kỳ thi đã hết hạn");

					// Check if exam has templates
					if (!exam.templates || exam.templates.length === 0) throw new Error("Không tìm thấy danh sách câu hỏi của kỳ thi.");

					const maxAttempts = exam.max_attempts;

					// Check if there's an existing in-progress attempt
					const latestAttempt = await examParticipantProvider.getLatestAttempt(examId, userId.toString());
					
					if (latestAttempt) {
						// If already in progress, return existing attempt
						if (latestAttempt.status === "in_progress") {
							return res.sendOk({
								data: {
									message: "Tiếp tục làm bài thi",
									attempt_number: latestAttempt.attempt_number,
									start_time: latestAttempt.start_time,
									allowed_time: exam.allowed_time,
									exam_name: exam.name,
									remaining_attempts: maxAttempts - latestAttempt.attempt_number,
								},
							});
						}

						// If submitted, check if can start new attempt
						if (latestAttempt.status === "submitted") {
							if (latestAttempt.attempt_number >= maxAttempts) {
								throw new Error(`Bạn đã sử dụng hết ${maxAttempts} lượt thi cho kỳ thi này`);
							}
							// Create new attempt with next attempt_number
							const newAttemptNumber = latestAttempt.attempt_number + 1;
							const templateId = (req.body as any)?.template_id as string | undefined;
							const shuffleResult = await examProvider.getShuffleQuestionsAndAnswers(examId, templateId);

							const shuffledQuestions = shuffleResult.answers.map((a) => a.question_id as any);
							const shuffledAnswers: Record<string, any> = {};
							shuffleResult.answers.forEach((a) => {
								shuffledAnswers[a.question_id.toString()] = a.question_answers;
							});

							await examParticipantProvider.createNewAttempt({
								exam_id: new mongoose.Types.ObjectId(examId) as any,
								user_id: new mongoose.Types.ObjectId(userId.toString()) as any,
								attempt_number: newAttemptNumber,
								shuffled_questions: shuffledQuestions,
								shuffled_answers: shuffledAnswers,
								start_time: new Date(),
							});

							return res.sendOk({
								data: {
									message: "Bắt đầu làm bài thi thành công",
									attempt_number: newAttemptNumber,
									start_time: new Date(),
									allowed_time: exam.allowed_time,
									exam_name: exam.name,
									remaining_attempts: maxAttempts - newAttemptNumber,
								},
							});
						}

						// If registered, update to in_progress
						if (latestAttempt.status === "registered") {
							const templateId = (req.body as any)?.template_id as string | undefined;
							const shuffleResult = await examProvider.getShuffleQuestionsAndAnswers(examId, templateId);

							const shuffledQuestions = shuffleResult.answers.map((a) => a.question_id as any);
							const shuffledAnswers: Record<string, any> = {};
							shuffleResult.answers.forEach((a) => {
								shuffledAnswers[a.question_id.toString()] = a.question_answers;
							});

							await examParticipantProvider.put(latestAttempt._id!.toString(), {
								status: "in_progress",
								shuffled_questions: shuffledQuestions,
								shuffled_answers: shuffledAnswers,
								start_time: new Date(),
							});

							return res.sendOk({
								data: {
									message: "Bắt đầu làm bài thi thành công",
									attempt_number: latestAttempt.attempt_number,
									start_time: new Date(),
									allowed_time: exam.allowed_time,
									exam_name: exam.name,
									remaining_attempts: maxAttempts - latestAttempt.attempt_number,
								},
							});
						}
					}

					// No existing participant found - user hasn't registered
					throw new Error("Bạn chưa đăng ký kỳ thi này");
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
