import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { UserProvider } from "#providers/userProvider";
import { Req, Res } from "#services/interfaces/iapi";
import { validateRegister } from "#middlewares/validator";
import { MailService } from "#services/mailService";
import { LoggingService } from "#services/file-system-handlers/logService";
import { UserAuthProvider } from "#providers/authProvider";
import { IUser } from "#models/user";
import { WebsiteConfigProvider } from "#providers/websiteConfigProvider";
import nconf from "nconf";
import constants from "#constants/index";
import { AuthMethods } from "#models/userAuth";
import otpGen from "otp-generator";

const emailTemplates = constants.EMAIL;

type UserRegister = Omit<
	IUser & { password: string },
	"is_admin" | "is_active" | "is_deleted" | "created_at" | "created_by" | "updated_at" | "updated_by"
>;

export default (_express: Application) => {
	const userProvider = new UserProvider();
	const userAuthProvider = new UserAuthProvider();
	const websiteConfigProvider = new WebsiteConfigProvider();
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
			const { password, profile, ...userValues } = req.body;

			// Get profile_schema from WebsiteConfig for validation
			const websiteConfig = await websiteConfigProvider.getOne({ where: { is_default: true } });
			const profileSchema = websiteConfig?.profile_schema || [];

			// Validate profile fields against profile_schema
			if (profileSchema.length > 0) {
				const validationError = validateProfile(profile, profileSchema);
				if (validationError) throw new Error(validationError);
			}

			// Check unique identity_number if present in profile
			if (profile?.identity_number) {
				const existingCCCD = await userProvider.getOne({
					where: { "profile.identity_number": profile.identity_number },
				});
				if (existingCCCD) throw new Error("Số CCCD đã được đăng ký trước đó");
			}

			const existingUser = await userProvider.getOne({
				where: { $or: [{ email: userValues.email }, { phone: userValues.phone }] },
			});
			if (existingUser) {
				if (existingUser.email === userValues.email) {
					if (existingUser.is_deleted)
						throw new Error("Tài khoản này đã bị xóa khỏi hệ thống. Vui lòng liên hệ quản trị viên để được giúp đỡ.");
					if (existingUser.is_active) throw new Error("Email này đã được đăng ký trước đó.");

					// User not activated yet → allow re-registration
					return await reRegister(existingUser, userValues, profile, password, res);
				}
				if (existingUser.phone === userValues.phone) {
					throw new Error("Số điện thoại đã được đăng ký trước đó");
				}
			}

			const user = await userProvider.post({ ...userValues, profile, is_active: false, is_deleted: false });
			const otp = await generateAndSendOtp(user.id, password, req.body.email);

			if (process.env.NODE_ENV.toLowerCase() != "production") return res.sendOk({ data: { otp } });
			return res.sendOk({ data: { message: "Đăng ký tài khoản thành công" } });
		} catch (error) {
			return res.sendError({ err: error });
		}
	}

	async function reRegister(
		existingUser: any,
		userValues: Omit<UserRegister, "password" | "profile">,
		profile: Record<string, any> | undefined,
		password: string,
		res: Res,
	): Promise<void> {
		// Check if new phone number is already registered by another user
		if (existingUser.phone !== userValues.phone) {
			const phoneUser = await userProvider.getOne({ where: { phone: userValues.phone } });
			if (phoneUser) throw new Error("Số điện thoại đã được đăng ký trước đó");
		}

		// Check if new CCCD is already registered by another user
		if (profile?.identity_number && profile.identity_number !== existingUser.profile?.identity_number) {
			const cccdUser = await userProvider.getOne({
				where: { "profile.identity_number": profile.identity_number },
			});
			if (cccdUser) throw new Error("Số CCCD đã được đăng ký trước đó");
		}

		// Update user information
		await userProvider.put(existingUser.id, {
			first_name: userValues.first_name,
			middle_name: userValues.middle_name,
			last_name: userValues.last_name,
			phone: userValues.phone,
			unit: userValues.unit,
			profile: profile,
		});

		// Update or create password auth record
		const passwordAuth = await userAuthProvider.getOne({
			where: { user: existingUser.id, auth_method: AuthMethods.PASSWORD },
		});
		if (passwordAuth) await passwordAuth.updateOne({ auth_key: password });
		else await userAuthProvider.post({ user: existingUser.id, auth_key: password, auth_method: AuthMethods.PASSWORD });

		// Generate new OTP
		const otp = otpGen.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
		const otpAuth = await userAuthProvider.getOne({
			where: { user: existingUser.id, auth_method: AuthMethods.OTP },
		});
		if (otpAuth) await otpAuth.updateOne({ auth_key: otp });
		else await userAuthProvider.post({ user: existingUser.id, auth_key: otp, auth_method: AuthMethods.OTP });

		await sendOtpEmail(userValues.email, otp);

		if (process.env.NODE_ENV.toLowerCase() != "production") return res.sendOk({ data: { otp } });
		return res.sendOk({ data: { message: "Đăng ký tài khoản thành công" } });
	}

	async function generateAndSendOtp(userId: any, password: string, email: string): Promise<string> {
		const otp = otpGen.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });

		await userAuthProvider.bulkCreate([
			{ user: userId, auth_key: password, auth_method: AuthMethods.PASSWORD },
			{ user: userId, auth_key: otp, auth_method: AuthMethods.OTP },
		]);

		await sendOtpEmail(email, otp);
		return otp;
	}

	async function sendOtpEmail(email: string, otp: string): Promise<void> {
		return new Promise((resolve, reject) => {
			mailService.sendmail(
				{
					from: nconf.get("smtpOptions:auth:user"),
					to: email,
					...emailTemplates.register(email, otp),
				},
				(err, info) => {
					if (err) {
						logger.logErrorAsync("register", err, null);
						return reject(err);
					}
					logger.logAsync("AUTH", "register", info, null);
					resolve();
				},
			);
		});
	}

	// Validate profile fields against profile_schema from WebsiteConfig
	function validateProfile(profile: Record<string, any> | undefined, profileSchema: any[]): string | null {
		if (!profile) return "Vui lòng cung cấp thông tin profile";

		for (const field of profileSchema) {
			const value = profile[field.key];

			// Check required fields
			if (field.required && (value === undefined || value === null || value === "")) {
				return `${field.label} là bắt buộc`;
			}

			// Skip validation if value is empty and not required
			if (!value && !field.required) continue;

			// Type validation
			switch (field.type) {
				case "text":
					if (typeof value !== "string") return `${field.label} phải là chuỗi ký tự`;
					break;
				case "number":
					if (typeof value !== "number" && isNaN(Number(value))) {
						return `${field.label} phải là số`;
					}
					break;
				case "date":
					if (!Date.parse(value)) return `${field.label} phải là ngày hợp lệ`;
					break;
				case "select":
					if (field.options && !field.options.includes(value)) {
						return `${field.label} phải là một trong các giá trị: ${field.options.join(", ")}`;
					}
					break;
			}
		}

		return null;
	}
};
