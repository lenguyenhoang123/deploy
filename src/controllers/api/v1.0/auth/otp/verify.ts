import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { IUser } from "#models/user";
import { IUserAuth } from "#models/userAuth";
import { UserAuthProvider } from "#providers/authProvider";

export default (_express: Application) => {
	const provider = new UserAuthProvider();
	return <Resource>{
		post: {
			handler: async (req: Req<IUser & IUserAuth, { email: string; otp: string }>, res: Res) => {
				/**
				 * @openapi
				 *  /auth/otp/verify:
				 *   post:
				 *     tags: [Auth]
				 *     description: Post
				 *     requestBody:
				 *      description: Verify Fields
				 *      required: true
				 *      content:
				 *       application/json:
				 *        schema:
				 *         type: object
				 *         properties:
				 *          email:
				 *           type: string
				 *           example: admin@meu-solutions.com
				 *          otp:
				 *           type: string
				 *           example: 12345678
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *            schema:
				 *             allOf:
				 *                - $ref: '#/components/schemas/Response'
				 *                - type: object
				 *                  properties:
				 *                    responseData:
				 *                     type: object
				 *                     properties:
				 *                      accessToken: string
				 *                      expiresIn: integer
				 */

				try {
					const { email, otp } = req.body;
					return res.sendOk({ data: await provider.verifyOtp(email, otp) });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
