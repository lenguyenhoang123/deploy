import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { UserProvider } from "#providers/userProvider";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";
import { QuestionBankProvider } from "#providers/questionBankProvider";
import { CertificateTemplateProvider } from "#providers/certificateTemplateProvider";
import { CertificateProvider } from "#providers/certificateProvider";
import { ObjectId } from "#models/certificate";
import { validateSubmitExamEntry } from "#middlewares/validator";
import { IExamParticipantAnswer, ExamParticipantStatus } from "#models/examParticipant";
import mongoose from "mongoose";

export default (_express: Application) => {
	const examProvider = new ExamProvider();
	const userProvider = new UserProvider();
	const examParticipantProvider = new ExamParticipantProvider();
	const questionBankProvider = new QuestionBankProvider();
	const certificateTemplateProvider = new CertificateTemplateProvider();
	const certificateProvider = new CertificateProvider();
	return <Resource>{
		put: {
			middleware: [verify, validateSubmitExamEntry],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/exam/{exam_id}/submit:
				 *   put:
				 *     tags: [User]
				 *     description: Submit an exam with answers calculation
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: exam_id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam ID to submit
				 *         required: true
				 *     requestBody:
				 *       description: Participant Answers with start/submit times and attempt number
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             $ref: '#/components/schemas/SubmitParticipantAnswers'
				 *           example:
				 *              {
				 *                "start_time": "2024-08-21T09:00:00Z",
				 *                "submit_time": "2024-08-21T10:00:00Z",
				 *                "attempt_number": 1,
				 *                "answers": [
				 *                  {
				 *                    "question_id": "6699f4391c7ab023b0a77b5b",
				 *                    "user_answer": "6699f4391c7ab023b0a77b5b"
				 *                  },
				 *                  {
				 *                    "question_id": "6699f4391c7ab023b0a77b5c",
				 *                    "text_answer": "Câu trả lời tự luận..."
				 *                  }
				 *                ]
				 *              }
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					let { answers } = req.body;

					const examId = req.params.exam_id as string;
					const exam = await examProvider.validateAndFetchExam(examId);

					// B4 Fix: Find the current in_progress participant instead of relying on client-sent attempt_number
					const participant = await examParticipantProvider.getOne({
						where: {
							exam_id: new mongoose.Types.ObjectId(examId),
							user_id: new mongoose.Types.ObjectId(userId.toString()),
							status: ExamParticipantStatus.IN_PROGRESS,
						},
					});

					if (!participant) throw new Error("Bạn chưa đăng ký kỳ thi này hoặc lượt thi không tồn tại");

					// Check if exam is already in progress or submitted (status is guaranteed IN_PROGRESS by query above)

					// B3 Fix: Use server-side times — never trust client start_time/submit_time
					const serverStartTime = participant.start_time!;
					const serverSubmitTime = new Date();

					// Validate time constraints using server times
					if (serverStartTime < exam.start_time)
						throw new Error("Thời gian bắt đầu không hợp lệ. Không thể bắt đầu làm bài trước khi diễn ra kỳ thi.");
					if (serverSubmitTime > exam.end_time)
						throw new Error("Thời gian nộp bài không hợp lệ. Không thể nộp bài khi kỳ thi đã kết thúc.");

					const timeTaken = examParticipantProvider.calculateTimeTakenInMinutes(serverStartTime, serverSubmitTime);

					// Get questions details for score calculation
					const questionIds = answers.map((a: any) => a.question_id);
					const questions = await questionBankProvider.getQuestionsByIds(questionIds);
					const questionsMap = new Map(questions.map((q) => [q._id!.toString(), q]));

					// Validate that all questions in answers belong to the exam
					const examQuestionIds = new Set(participant.questions.map((q) => q.toString()));
					for (const answer of answers) {
						if (!examQuestionIds.has(answer.question_id)) {
							throw new Error(`Câu hỏi ${answer.question_id} không thuộc đề thi của bạn`);
						}
					}

					// Process and validate answers
					const processedAnswers: IExamParticipantAnswer[] = answers.map((answer: any) => {
						const question = questionsMap.get(answer.question_id);
						if (!question) {
							throw new Error(`Câu hỏi ${answer.question_id} không tồn tại`);
						}

						const processedAnswer: IExamParticipantAnswer = {
							question_id: new mongoose.Types.ObjectId(answer.question_id) as any,
						};

						// Handle multiple choice answers
						if (answer.user_answer) {
							processedAnswer.user_answer = new mongoose.Types.ObjectId(answer.user_answer) as any;
							// Calculate is_correct for MC questions
							const isCorrect = question.answers.some(
								(a) => a._id.toString() === answer.user_answer && a.is_correct
							);
							processedAnswer.is_correct = isCorrect;
						}

						// Handle essay answers
						if (answer.text_answer) {
							processedAnswer.text_answer = answer.text_answer;
							// is_correct for essay is null until manually graded
							processedAnswer.is_correct = null;
						}

						return processedAnswer;
					});

					// Calculate score (only for MC questions)
					let score = 0;
					for (const answer of processedAnswers) {
						const question = questionsMap.get(answer.question_id.toString());
						if (question && answer.is_correct === true) {
							score++;
						}
					}

					// Check if all questions are graded (no ungraded essays)
					const hasUngradedEssay = processedAnswers.some(a => a.is_correct === null);
					const is_graded = !hasUngradedEssay;

					// Update participant record
					const updateData = {
						status: ExamParticipantStatus.SUBMITTED,
						start_time: serverStartTime,
						submit_time: serverSubmitTime,
						time_taken: timeTaken,
						score,
						answers: processedAnswers,
						is_graded,
					};

					const result = await examParticipantProvider.put(participant._id!.toString(), updateData);

					if (result.modifiedCount <= 0) throw new Error("Có lỗi xảy ra khi nộp bài thi");

					// Auto-generate certificate if enabled and conditions are met
					try {
						const template = await certificateTemplateProvider.getByExamId(examId);
						if (template && template.is_enabled) {
							// Check if there are ungraded essay questions
							const hasUngradedEssay = processedAnswers.some(a => a.is_correct === null);

							if (hasUngradedEssay) {
								// Skip certificate creation - will be handled after essay grading
							} else {
								const totalQuestions = processedAnswers.length;
								const correctAnswers = processedAnswers.filter(a => a.is_correct === true).length;

								const meetsConditions = certificateProvider.checkConditions(
									template,
									score, // Use absolute score instead of percentage
									totalQuestions,
									correctAnswers
								);

								if (meetsConditions) {
									try {
										const user = await userProvider.getById(userId.toString());
										const existingCert = await certificateProvider.getByParticipantId(participant._id!.toString());

										if (!existingCert) {
											await certificateProvider.createCertificate({
												type: "exam",
												exam_id: new ObjectId(examId),
												user_id: new ObjectId(userId.toString()),
												participant_id: participant._id!,
												template_id: template._id,
												user_info: {
													full_name: `${user.last_name} ${user.middle_name || ""} ${user.first_name}`.trim(),
													identity_number: user.profile?.identity_number,
													class_name: user.profile?.class_name,
													school_name: user.profile?.school_name,
												},
												exam_info: {
													name: exam.name,
													completion_date: serverSubmitTime,
													score: score, // Use absolute score
												},
												status: "active",
											});
										}
									} catch (certError) {
										// Log error but don't fail the submission
										console.error("Certificate generation error:", certError);
									}
								}
							}
						}
					} catch (certTemplateError) {
						// Log error but don't fail the submission
						console.error("Certificate template error:", certTemplateError);
					}

					return res.sendOk({
						data: { message: "Nộp bài thi thành công" },
						message: "Nộp bài thi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
