import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { UserAuthProvider } from "#providers/authProvider";
import { Req, Res } from "#services/interfaces/iapi";
import { AuthMethods, IUserAuth } from "#models/userAuth";
import verify from "#middlewares/auth";
import { validatePasswordEntry } from "#middlewares/validator";

export default (_express: Application) => {
	const userAuthProvider = new UserAuthProvider();

	return <Resource>{
		post: {
			middleware: [verify, validatePasswordEntry],
			handler: async (req: Req<IUserAuth, { password: string }>, res: Res) => {
				/**
				 * @openapi
				 * /auth/reset-password:
				 *   post:
				 *     tags: [Auth]
				 *     description: Reset user password
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *      required: true
				 *      content:
				 *       application/json:
				 *        schema:
				 *          type: object
				 *          properties:
				 *           password:
				 *            type: string
				 *            example: "12345678"
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *            schema:
				 *             $ref: '#/components/schemas/Response'
				 */

				await resetPassword(req, res);
			},
		},
	};

	async function resetPassword(req: Req<IUserAuth, { password: string }>, res: Res): Promise<void> {
		try {
			const { password } = req.body;
			const user = req.user;

			if (!user || !user.id) throw new Error("Lấy thông tin tài khoản thất bại!");

			const auth = await userAuthProvider.getOne({
				where: { user: user.id, auth_method: AuthMethods.PASSWORD },
				attributes: ["auth_key"],
			});

			if (!auth) throw new Error("Chưa tạo mật khẩu");
			if (auth.compareKey(password)) throw new Error("Mật khẩu mới trùng với mật khẩu cũ!");

			return res.sendOk({
				data: await auth.updateOne({ auth_key: password }),
				message: "Đổi mật khẩu thành công",
			});
		} catch (error) {
			return res.sendError({ err: error });
		}
	}
};
