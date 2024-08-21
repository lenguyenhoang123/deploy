import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { IExam } from "#models/exam";
import mongoose from "mongoose";
import dayjs from "dayjs";
import { UserProvider } from "#providers/userProvider";

export default (_express: Application) => {
	const provider = new ExamProvider();
	const userProvider = new UserProvider();
	return <Resource>{
		put: {
			middleware: verify,
			handler: async (req: Req<IExam>, res: Res) => {
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

					const examId = req.params.exam_id as string;
					const exam = await provider.validateAndFetchExam(examId);

					if (currentTime < exam.start_time) throw new Error("Kỳ thi chưa diễn ra");
					if (currentTime > exam.end_time) throw new Error("Kỳ thi đã hết hạn");

					const userId = await userProvider.getUserIdFromRequest(req);

					let participant = exam.participants.find((p) => p.user_id.toString() === userId.toString());
					if (!participant) throw new Error("Bạn chưa đăng ký kỳ thi này");

					if (participant.submit_time) throw new Error("Bạn đã hoàn thành bài thi. Không thể bắt đầu.");

					if (!exam.template) throw new Error("Không tìm thấy danh sách câu hỏi của kỳ thi.");

					// Shuffle Questions And Answers For Participant
					if (!participant.answers || participant.answers.length === 0) {
						participant.answers = await provider.getShuffleQuestionsAndAnswers(examId);

						const remainingParticipants = exam.participants.filter((p) => p.user_id.toString() !== userId.toString());
						const updatedParticipants = [...remainingParticipants, participant];

						const data = await exam.updateOne({
							participants: updatedParticipants,
						});

						if (data.modifiedCount <= 0) throw new Error("Có lỗi xảy ra khi bắt đầu bài thi");
					}

					return res.sendOk({ data: { message: "Bắt đầu làm bài thi thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
