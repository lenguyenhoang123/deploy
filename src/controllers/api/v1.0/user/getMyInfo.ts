import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { UserProvider } from "#providers/userProvider";

export default (_express: Application) => {
	const provider = new UserProvider();
	return <Resource>{
		get: {
			middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 *  /user/getMyInfo:
				 *   get:
				 *     tags: [User]
				 *     description: Get
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
	};
};
