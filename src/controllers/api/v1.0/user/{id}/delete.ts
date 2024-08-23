import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { UserProvider } from "#providers/userProvider";
import mongoose from "mongoose";

export default (_express: Application) => {
	const provider = new UserProvider();

	return <Resource>{
		put: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/{id}/delete:
				 *   put:
				 *     tags: [User]
				 *     description: Delete user by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: User ID to delete
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

					const userId = req.params.id as string;
					if (!userId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(userId)) throw new Error("ID không hợp lệ");

					await provider.validateUserId(req.user.id as string);

					const user = await provider.getById(userId, {
						attributes: ["is_deleted"],
					});
					provider.validateUser(user, false, true, "người dùng");

					const data = await user.updateOne({
						is_deleted: true,
						updated_by: userId,
						updated_at: currentTime,
					});

					if (data.modifiedCount <= 0) throw new Error("Có lỗi xảy ra khi xóa người dùng");
					return res.sendOk({ data: { message: "Xóa người dùng thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
