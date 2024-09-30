import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { QuestionBankProvider } from "#providers/questionBankProvider";
import mongoose from "mongoose";
import { UserProvider } from "#providers/userProvider";

export default (_express: Application) => {
	const provider = new QuestionBankProvider();
	const userProvider = new UserProvider();
	return <Resource>{
		put: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /question-bank/{id}/delete:
				 *   put:
				 *     tags: [Question Bank]
				 *     description: Delete question by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Question ID to delete
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
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);

					const questionId = req.params.id as string;
					if (!questionId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(questionId)) throw new Error("ID không hợp lệ");

					const question = await provider.getById(questionId, {
						attributes: ["is_deleted", "updated_by"],
					});
					if (!question) throw new Error("Câu hỏi không tồn tại");
					if (question.is_deleted) throw new Error("Câu hỏi đã bị xóa trước đó");

					const data = await question.updateOne({
						is_deleted: true,
						updated_by: userId,
					});

					if (data.modifiedCount <= 0) throw new Error("Có lỗi xảy ra khi xóa câu hỏi");
					return res.sendOk({ data: { message: "Xóa câu hỏi thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
