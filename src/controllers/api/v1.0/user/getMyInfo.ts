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
					return res.sendOk({
						data: await provider.getById(req.user.id, { attributes: ["first_name", "last_name", "phone", "email"] }),
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
