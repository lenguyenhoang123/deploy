import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { UserProvider } from "#providers/userProvider";
import mongoose from "mongoose";

export default (_express: Application) => {
	const provider = new UserProvider();
	return <Resource>{
		delete: {
			// middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/delete:
				 *   delete:
				 *     tags: [User]
				 *     description: Delete user by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: query
				 *         description: User ID to delete
				 *         required: true
				 *         schema:
				 *           type: string
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					const deleteId = req.query.id as string;

					if (!deleteId) throw new Error("ID không được để trống");

					if (!mongoose.Types.ObjectId.isValid(deleteId)) throw new Error("ID không hợp lệ");

					const existingUser = await provider.getById(deleteId);
					if (!existingUser) throw new Error("Người dùng không tồn tại");

					return res.sendOk({
						data: await provider.delete(deleteId),
						message: "Xóa người dùng thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
