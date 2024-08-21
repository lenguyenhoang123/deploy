import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import mongoose from "mongoose";
import { UserProvider } from "#providers/userProvider";

export default (_express: Application) => {
	const examProvider = new ExamProvider();
	const userProvider = new UserProvider();
	return <Resource>{
		get: {
			middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/exam/{exam_id}/result:
				 *   get:
				 *     tags: [User]
				 *     description: Get exam result for participant
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
					const userId = await userProvider.getUserIdFromRequest(req);

					const examId = req.params.exam_id as string;
					const exam = await examProvider.validateAndFetchExam(examId);

					let participant = exam.participants.find((p) => p.user_id.toString() === userId.toString());
					if (!participant) throw new Error("Bạn chưa đăng ký kỳ thi này");

					if (!participant.start_time || !participant.answers || participant.answers.length === 0)
						throw new Error("Bạn chưa làm bài thi. Không thể xem kết quả.");
					if (!participant.submit_time) throw new Error("Bạn chưa nộp bài thi. Không thể xem kết quả.");

					const data = await examProvider.getExamResultForParticipant(examId, userId.toString(), true);
					if (!data) throw new Error("Lấy kết quả bài thi của thí sinh thất bại");

					return res.sendOk({
						data: data,
						message: "Lấy kết quả bài thi của thí sinh thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
