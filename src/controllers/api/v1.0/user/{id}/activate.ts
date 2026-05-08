import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { UserProvider } from "#providers/userProvider";
import mongoose from "mongoose";

export default (_express: Application) => {
	const provider = new UserProvider();
	return <Resource>{
		patch: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/{id}/activate:
				 *   patch:
				 *     tags: [User]
				 *     description: Activate user account (admin only). This will also reactivate deleted accounts (set is_deleted = false and is_active = true).
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: User ID to activate/reactivate
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
					const userId = req.params.id as string;
					
					if (!mongoose.Types.ObjectId.isValid(userId)) {
						throw new Error("User ID không hợp lệ");
					}

					const user = await provider.getById(userId);
					
					if (!user) {
						throw new Error("Không tìm thấy người dùng");
					}

					const wasDeleted = user.is_deleted;
					const wasActive = user.is_active;

					// Reactivate and activate account
					await user.updateOne({ 
						is_deleted: false,
						is_active: true 
					});

					let message = "Kích hoạt tài khoản thành công";
					if (wasDeleted) {
						message = "Mở lại và kích hoạt tài khoản thành công";
					} else if (wasActive) {
						message = "Tài khoản đã được kích hoạt";
					}

					return res.sendOk({ data: { message } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
