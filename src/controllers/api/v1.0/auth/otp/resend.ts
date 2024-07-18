import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { UserProvider } from "#providers/userProvider";
import { Req, Res } from "#services/interfaces/iapi";
import { validateEmailEntry } from "#middlewares/validator";
import { MailService } from "#services/mailService";
import { LoggingService } from "#services/file-system-handlers/logService";
import { UserAuthProvider } from "#providers/authProvider";
import nconf from "nconf";
import constants from "#constants/index";
import { AuthMethods, IUserAuth } from "#models/userAuth";
import otpGen from "otp-generator";

const emailTemplates = constants.EMAIL;

export default (_express: Application) => {
	const userProvider = new UserProvider();
	const userAuthProvider = new UserAuthProvider();
	const mailService = new MailService();
	const logger = new LoggingService();

	return <Resource>{
		post: {
			middleware: validateEmailEntry,
			handler: async (req: Req<IUserAuth, { email: string }>, res: Res) => {
				/**
				 * @openapi
				 * /auth/otp/resend:
				 *   post:
				 *     tags: [Auth]
				 *     description: Resend OTP
				 *     requestBody:
				 *      description: Resend Fields
				 *      required: true
				 *      content:
				 *       application/json:
				 *        schema:
				 *          type: object
				 *          properties:
				 *           email:
				 *            type: string
				 *            example: admin@meu-solutions.com
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *            schema:
				 *             $ref: '#/components/schemas/Response'
				 */

				await resend(req, res);
			},
		},
	};

	async function resend(req: Req<IUserAuth, { email: string }>, res: Res): Promise<void> {
		try {
			const user = await userProvider.getOne({ where: { email: req.body.email } });
			if (!user) throw new Error("Không tìm thấy người dùng");
			const otp = otpGen.generate(6, {
				lowerCaseAlphabets: false,
				upperCaseAlphabets: false,
				specialChars: false,
			});

			const otpAuth = await userAuthProvider.getOne({ where: { user: user.id, auth_method: AuthMethods.OTP } });
			if (otpAuth) await otpAuth.updateOne({ auth_key: otp });
			else await userAuthProvider.post({ user: user.id, auth_method: AuthMethods.OTP, auth_key: otp });

			mailService.sendmail(
				{
					from: nconf.get("smtpOptions:auth:user"),
					to: req.body.email,
					...emailTemplates.register(req.body.email, otp),
				},
				(err, info) => {
					if (err) return logger.logErrorAsync("register", err, null);
					return logger.logAsync("AUTH", "register", info, null);
				},
			);

			if (process.env.NODE_ENV.toLowerCase() != "production") return res.sendOk({ data: { otp } });
			return res.sendOk({ data: { message: "Gửi mã xác minh thành công" } });
		} catch (error) {
			return res.sendError({ err: error });
		}
	}
};
