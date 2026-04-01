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
		get: {
			middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/{id}/templates/list:
				 *   get:
				 *     tags: [Exam]
				 *     description: Get simple list of exam templates (for dropdown)
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam ID to get templates list
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
					const examId = req.params.id as string;
					if (!examId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("ID không hợp lệ");

					await userProvider.validateUserId(req.user.id as string);
					const result = await examProvider.getTemplatesList(examId);

					return res.sendOk({
						data: result,
						message: "Lấy danh sách bộ đề thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
