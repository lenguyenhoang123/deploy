import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import mongoose from "mongoose";

export default (_express: Application) => {
	const examProvider = new ExamProvider();
	return <Resource>{
		get: {
			middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/exam/{exam_id}/details:
				 *   get:
				 *     tags: [User]
				 *     description: Get exam details for participant
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
					if (!req.user || !req.user.id) throw new Error("Lấy thông tin tài khoản thất bại!");
					const userId = req.user.id;

					const examId = req.params.exam_id as string;
					if (!examId) throw new Error("Exam ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("Exam ID không hợp lệ");

					const data = await examProvider.getExamDetailsForParticipant(examId, userId);
					if (!data) throw new Error("Lấy chi tiết đề thi của thí sinh thất bại");

					return res.sendOk({
						data: data,
						message: "Lấy chi tiết đề thi của thí sinh thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
