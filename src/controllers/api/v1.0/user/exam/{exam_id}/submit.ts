import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { IExam, IParticipantAnswer } from "#models/exam";
import mongoose from "mongoose";

export default (_express: Application) => {
	const examProvider = new ExamProvider();
	return <Resource>{
		put: {
			middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/exam/{exam_id}/submit:
				 *   put:
				 *     tags: [User]
				 *     description: Submit an exam
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
				 *       description: Participant Answers
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             $ref: '#/components/schemas/ParticipantAnswers'
				 *           example:
				 *              [
				 *                {
				 *                  "question_id": "6699f4391c7ab023b0a77b5b",
				 *                  "user_answer": "6699f4391c7ab023b0a77b5b"
				 *                },
				 *                {
				 *                  "question_id": "6699f4391c7ab023b0a77b5b",
				 *                  "user_answer": ""
				 *                }
				 *              ]
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					if (!req.user || !req.user.id) throw new Error("Lấy thông tin tài khoản thất bại!");
					const userId = req.user.id;

					const examId = req.params.exam_id as string;
					if (!examId) throw new Error("Exam ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("Exam ID không hợp lệ");

					const exam = await examProvider.getById(examId);
					if (!exam) throw new Error("Kỳ thi không tồn tại");

					const currentTime = new Date();
					if (currentTime < exam.start_time) throw new Error("Kỳ thi chưa diễn ra");
					if (currentTime > exam.end_time) throw new Error("Kỳ thi đã hết hạn");

					let participant = exam.participants.find((p) => p.user_id.toString() === userId);
					if (!participant) throw new Error("Bạn chưa đăng ký kỳ thi này");

					if (!participant.start_time || !participant.answers || participant.answers.length === 0)
						throw new Error("Bạn chưa bắt đầu bài thi. Không thể nộp bài.");
					if (participant.submit_time) throw new Error("Bạn đã hoàn thành bài thi. Không thể nộp bài.");

					// Update Exam's Participants
					const submittedAnswers = req.body;
					const remainingParticipants = exam.participants.filter((p) => p.user_id.toString() !== userId);
					let updatedParticipants = remainingParticipants;
					let updatedParticipant = participant;
					updatedParticipant.answers = await updateParticipantAnswersWithSubmittedAnswers(
						participant.answers,
						submittedAnswers,
					);
					updatedParticipant.submit_time = currentTime;
					updatedParticipants.push(updatedParticipant);

					const data = await exam.updateOne({
						participants: updatedParticipants,
						updated_by: userId,
						updated_at: currentTime,
					});

					if (data.modifiedCount <= 0) throw new Error("Có lỗi xảy ra khi bắt đầu bài thi");
					return res.sendOk({ data: { message: "Nộp bài thi thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};

	async function updateParticipantAnswersWithSubmittedAnswers(
		originalAnswers: IParticipantAnswer[],
		newSubmittedAnswers: IParticipantAnswer[],
	): Promise<IParticipantAnswer[]> {
		const answerMap = new Map(
			newSubmittedAnswers.map(({ question_id, user_answer }) => [question_id.toString(), user_answer]),
		);
		return originalAnswers.map((answer) => ({
			...answer,
			user_answer: answerMap.get(answer.question_id.toString()) || answer.user_answer,
		}));
	}
};
