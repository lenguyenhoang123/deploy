import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { UserProvider } from "#providers/userProvider";
import { validateUpdateUserInfoEntry } from "#middlewares/validator";

export default (_express: Application) => {
	const provider = new UserProvider();
	return <Resource>{
		get: {
			middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 *  /user/myInfo:
				 *   get:
				 *     tags: [User]
				 *     description: Get My Info
				 *     security:
				 *       - Bearer: []
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *            schema:
				 *                $ref: '#/components/schemas/Response'
				 */

				try {
					const user = await provider.getById(req.user.id, {
						attributes: ["first_name", "middle_name", "last_name", "email", "phone", "unit", "is_admin", "is_active"],
					});

					if (!user) throw new Error("Tài khoản không tồn tại");
					if (!user.is_active) throw new Error("Tài khoản chưa được kích hoạt");

					const userDetails = {
						_id: user.id,
						full_name: user.full_name(),
						email: user.email,
						phone: user.phone,
						unit: user.unit,
						is_admin: user.is_admin,
					};

					return res.sendOk({ data: userDetails, message: "Lấy thông tin tài khoản thành công" });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		put: {
			middleware: [verify, validateUpdateUserInfoEntry],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 *  /user/myInfo:
				 *   put:
				 *     tags: [User]
				 *     description: Update My Info
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *       description: Update My Info Fields
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *            $ref: "#/components/schemas/updateUserInfo"
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *            schema:
				 *                $ref: '#/components/schemas/Response'
				 */

				try {
					const currentTime = new Date();
					if (!req.user || !req.user.id) throw new Error("Lấy thông tin tài khoản thất bại!");
					const userId = req.user.id;

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
	};
};
