import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { UserProvider } from "#providers/userProvider";
import mongoose from "mongoose";

export default (_express: Application) => {
	const examProvider = new ExamProvider();
	const userProvider = new UserProvider();
	return <Resource>{
		put: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/{id}/templates/{template_id}/shuffle:
				 *   put:
				 *     tags: [Exam]
				 *     description: Shuffle/Randomize questions in an existing template
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam ID
				 *         required: true
				 *       - name: template_id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 69ca4d16cc523335772b55ee
				 *         description: Template ID to shuffle
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
					const examId = req.params.id as string;
					const templateId = req.params.template_id as string;

					if (!examId) throw new Error("ID kỳ thi không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("ID kỳ thi không hợp lệ");

					if (!templateId) throw new Error("ID đề thi không được để trống");
					if (!mongoose.Types.ObjectId.isValid(templateId)) throw new Error("ID đề thi không hợp lệ");

					await userProvider.validateAndFetchUserId(req.user.id as string);
					const exam = await examProvider.getById(examId);
					if (!exam) throw new Error("Kỳ thi không tồn tại");

					// Only allow shuffle before exam starts
					if (currentTime >= exam.start_time) {
						throw new Error("Không thể đổi câu hỏi cho kỳ thi đã hoặc đang diễn ra");
					}

					const result = await examProvider.shuffleTemplateQuestions(examId, templateId);

					return res.sendOk({
						data: result,
						message: "Đổi câu hỏi ngẫu nhiên thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
