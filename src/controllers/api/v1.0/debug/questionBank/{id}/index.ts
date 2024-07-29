import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { QuestionBankProvider } from "#providers/questionBankProvider";
import mongoose from "mongoose";

export default (_express: Application) => {
	const provider = new QuestionBankProvider();

	return <Resource>{
		delete: {
			middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /debug/questionBank/{id}:
				 *   delete:
				 *     tags: [Question Bank]
				 *     description: Delete question bank by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: ID to delete
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
					const deleteId = req.params.id as string;
					if (!deleteId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(deleteId)) throw new Error("ID không hợp lệ");

					const existingItem = await provider.getById(deleteId);
					if (!existingItem) throw new Error("Câu hỏi không tồn tại");

					return res.sendOk({
						data: await provider.delete(deleteId),
						message: "Xóa câu hỏi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
