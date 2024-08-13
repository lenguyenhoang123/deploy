import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import mongoose from "mongoose";

export default (_express: Application) => {
	const provider = new ExamProvider();
	return <Resource>{
		get: {
			middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/{id}:
				 *   get:
				 *     tags: [Exam]
				 *     description: Get exam by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: ID
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
					const itemId = req.params.id as string;
					if (!itemId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(itemId)) throw new Error("ID không hợp lệ");

					const data = await provider.getById(itemId, {
						attributes: [
							"name",
							"description",
							"start_time",
							"end_time",
							"allowed_time",
							"template",
							"participants",
							"created_by",
							"updated_by",
							"created_at",
							"updated_at",
						],
					});
					if (!data) throw new Error("Kỳ thi không tồn tại");

					return res.sendOk({
						data: data,
						message: "Lấy thông tin kỳ thi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		delete: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/{id}:
				 *   delete:
				 *     tags: [Exam]
				 *     description: Delete exam by ID.
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
					if (!existingItem) throw new Error("Kỳ thi không tồn tại");

					return res.sendOk({
						data: await provider.delete(deleteId),
						message: "Xóa kỳ thi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
