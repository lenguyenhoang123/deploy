import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { UserProvider } from "#providers/userProvider";
import mongoose from "mongoose";
import { validateUpdateUserInfoEntry } from "#middlewares/validator";

export default (_express: Application) => {
	const provider = new UserProvider();

	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/{id}:
				 *   get:
				 *     tags: [User]
				 *     description: Get user by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: User ID
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
					if (!userId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(userId)) throw new Error("ID không hợp lệ");

					await provider.validateUserId(req.user.id as string);

					const user = await provider.getById(userId, {
						attributes: [
							"first_name",
							"middle_name",
							"last_name",
							"email",
							"phone",
							"unit",
							"profile",
							"is_active",
							"is_admin",
							"is_deleted",
							"created_at",
						],
					});
					provider.validateUser(user, false, false, "người dùng");

					const userDetails = {
						full_name: user.full_name(),
						email: user.email,
						phone: user.phone,
						unit: user.unit,
						profile: user.profile,
						is_admin: user.is_admin,
						is_active: user.is_active,
						is_deleted: user.is_deleted,
						created_at: user.created_at,
					};

					return res.sendOk({ data: userDetails, message: "Lấy thông tin người dùng thành công" });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		put: {
			middleware: [verify, verifyAdmin, validateUpdateUserInfoEntry],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/{id}:
				 *   put:
				 *     tags: [User]
				 *     description: Update user by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: User ID to update
				 *         required: true
				 *     requestBody:
				 *       description: Update User Fields
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             $ref: "#/components/schemas/updateUserInfo"
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
						attributes: ["first_name", "middle_name", "last_name", "unit", "profile", "is_active", "is_deleted"],
					});
					provider.validateUser(user, false, false, "người dùng");

					const updatedUser = req.body;
					const data = await user.updateOne({
						first_name: updatedUser.first_name,
						middle_name: updatedUser.middle_name,
						last_name: updatedUser.last_name,
						unit: updatedUser.unit,
						profile: updatedUser.profile,
						updated_by: userId,
						updated_at: currentTime,
					});

					if (data.modifiedCount <= 0) throw new Error("Có lỗi xảy ra khi cập nhật thông tin người dùng");
					return res.sendOk({ data: { message: "Cập nhật thông tin người dùng thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
