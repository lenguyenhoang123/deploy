import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { UserProvider } from "#providers/userProvider";
import mongoose from "mongoose";
import { UserAuthProvider } from "#providers/authProvider";
import { validateUpdateUserInfoEntry } from "#middlewares/validator";

export default (_express: Application) => {
	const provider = new UserProvider();
	const userAuthProvider = new UserAuthProvider();

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

					const user = await provider.getById(userId, {
						attributes: [
							"first_name",
							"middle_name",
							"last_name",
							"email",
							"phone",
							"unit",
							"is_admin",
							"is_active",
							"created_at",
						],
					});
					if (!user) throw new Error("Tài khoản không tồn tại");

					const userDetails = {
						full_name: user.full_name(),
						email: user.email,
						phone: user.phone,
						unit: user.unit,
						is_admin: user.is_admin,
						is_active: user.is_active,
						created_at: user.created_at,
					};

					return res.sendOk({ data: userDetails, message: "Lấy thông tin tài khoản thành công" });
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

					const user = await provider.getById(userId, {
						attributes: ["first_name", "middle_name", "last_name", "unit", "is_active"],
					});

					if (!user) throw new Error("Tài khoản không tồn tại");
					if (!user.is_active) throw new Error("Tài khoản chưa được kích hoạt");

					const updatedUser = req.body;
					const data = await user.updateOne({
						first_name: updatedUser.first_name,
						middle_name: updatedUser.middle_name,
						last_name: updatedUser.last_name,
						unit: updatedUser.unit,
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

		delete: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/{id}:
				 *   delete:
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
					const deleteId = req.params.id as string;
					if (!deleteId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(deleteId)) throw new Error("ID không hợp lệ");

					const existingUser = await provider.getById(deleteId);
					if (!existingUser) throw new Error("Người dùng không tồn tại");

					const userAuthToDelete = await userAuthProvider.getAll({ where: { user: deleteId } });
					if (userAuthToDelete) await userAuthProvider.bulkDelete({ user: deleteId });

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
