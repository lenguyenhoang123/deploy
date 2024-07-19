import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { UserProvider } from "#providers/userProvider";
import { Req, Res } from "#services/interfaces/iapi";
import { validateRegister } from "#middlewares/validator";
import { MailService } from "#services/mailService";
import { LoggingService } from "#services/file-system-handlers/logService";
import { UserAuthProvider } from "#providers/authProvider";
import { IUser } from "#models/user";
import nconf from "nconf";
import constants from "#constants/index";
import { AuthMethods } from "#models/userAuth";
import otpGen from "otp-generator";

const emailTemplates = constants.EMAIL;

type UserRegister = Omit<
	IUser & { password: string },
	"is_admin" | "is_active" | "created_at" | "created_by" | "updated_at" | "updated_by"
>;

export default (_express: Application) => {
	const userProvider = new UserProvider();
	const userAuthProvider = new UserAuthProvider();
	const mailService = new MailService();
	const logger = new LoggingService();

	return <Resource>{
		post: {
			middleware: validateRegister,
			handler: async (req: Req<IUser, UserRegister>, res: Res) => {
				/**
				 * @openapi
				 * /auth/register:
				 *   post:
				 *     tags: [Auth]
				 *     description: Register new user
				 *     requestBody:
				 *      description: Register Fields
				 *      required: true
				 *      content:
				 *       application/json:
				 *        schema:
				 *          $ref: "#/components/schemas/userRegister"
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *            schema:
				 *             $ref: '#/components/schemas/Response'
				 */

				await register(req, res);
			},
		},
	};

	async function register(req: Req<IUser, UserRegister>, res: Res): Promise<void> {
		try {
			const { password, ...userValues } = req.body;

			const existingUser = await userProvider.getOne({
				where: { $or: [{ email: userValues.email }, { phone: userValues.phone }] },
			});
			if (existingUser) {
				if (existingUser.email === userValues.email) {
					throw new Error("Email đã được đăng ký trước đó");
				}
				if (existingUser.phone === userValues.phone) {
					throw new Error("Số điện thoại đã được đăng ký trước đó");
				}
			}

			const user = await userProvider.post({ ...userValues, is_active: false });
			const otp = otpGen.generate(6, {
				lowerCaseAlphabets: false,
				upperCaseAlphabets: false,
				specialChars: false,
			});
			await userAuthProvider.bulkCreate([
				{
					user: user.id,
					auth_key: password,
					auth_method: AuthMethods.PASSWORD,
				},
				{
					user: user.id,
					auth_key: otp,
					auth_method: AuthMethods.OTP,
				},
			]);

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
			return res.sendOk({ data: { message: "Đăng ký tài khoản thành công" } });
		} catch (error) {
			return res.sendError({ err: error });
		}
	}
};
