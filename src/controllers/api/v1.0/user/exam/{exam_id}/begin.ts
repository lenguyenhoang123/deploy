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
					const userId = await userProvider.getUserIdFromRequest(req);

					const examId = req.params.exam_id as string;
					if (!examId) throw new Error("Exam ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("Exam ID không hợp lệ");

					const exam = await provider.getById(examId);
					if (!exam) throw new Error("Kỳ thi không tồn tại");

					if (currentTime < exam.start_time) throw new Error("Kỳ thi chưa diễn ra");
					if (currentTime > exam.end_time) throw new Error("Kỳ thi đã hết hạn");

					const participant = exam.participants.find((p) => p.user_id.toString() === userId.toString());
					if (!participant) throw new Error("Bạn chưa đăng ký kỳ thi này");

					if (participant.submit_time) throw new Error("Bạn đã hoàn thành bài thi. Không thể bắt đầu.");

					if (!exam.template) throw new Error("Không tìm thấy danh sách câu hỏi của kỳ thi.");

					// Update Exam's Participants
					const remainingParticipants = exam.participants.filter((p) => p.user_id.toString() !== userId.toString());
					let updatedParticipants = remainingParticipants;
					let updatedParticipant = participant;
					if (!participant.answers || participant.answers.length === 0) {
						updatedParticipant.answers = await provider.getShuffleQuestionsAndAnswers(examId);
					}
					updatedParticipant.start_time = currentTime;
					updatedParticipants.push(updatedParticipant);

					const data = await exam.updateOne({
						participants: updatedParticipants,
					});

					if (data.modifiedCount <= 0) throw new Error("Có lỗi xảy ra khi bắt đầu bài thi");
					return res.sendOk({ data: { message: "Bắt đầu làm bài thi thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
