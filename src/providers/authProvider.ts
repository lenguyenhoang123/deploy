import dayjs from "dayjs";
import nconf from "nconf";
import { BaseProvider } from "#templates/base/baseProvider";
import { UserProvider } from "./userProvider";
import { AuthMethods, IUserAuth, IUserAuthMethods, collectionName, schema } from "#models/userAuth";
import { sign as signJwt, SignOptions } from "jsonwebtoken";
import { AuthPayload } from "#services/interfaces/iapi";

export class UserAuthProvider extends BaseProvider<IUserAuth, IUserAuthMethods> {
	private userProvider: UserProvider;
	constructor() {
		super({ collectionName, schema });
		this.userProvider = new UserProvider();
	}

	async login(email: string, password: string) {
		// Get User
		const user = await this.userProvider.getOne({ where: { email }, attributes: ["id", "is_active"] });
		if (!user) throw new Error("Không tìm thấy người dùng");
		if (!user.is_active) throw new Error("Người dùng chưa được kích hoạt");
		// Get password
		const auth = await this.getOne({
			where: { user: user.id, auth_method: AuthMethods.PASSWORD },
			attributes: ["auth_key"],
		});
		if (!auth) throw new Error("Chưa tạo mật khẩu");
		if (!auth.compareKey(password)) throw new Error("Mật khẩu không hợp lệ");
		const // Set token
			tokenLife = dayjs().endOf("day").valueOf() - dayjs().valueOf(),
			tokenPayload = { id: user.id, isAdmin: user.is_admin },
			tokenSecret = nconf.get("JWT:Secret"),
			tokenOptions = { expiresIn: tokenLife } satisfies SignOptions;

		return {
			accessToken: signJwt(tokenPayload, tokenSecret, tokenOptions),
			expiresIn: tokenLife,
		};
	}

	async verifyOtp(email: string, otp: string) {
		const user = await this.userProvider.getOne({ where: { email }, attributes: ["id"] });
		if (!user) throw new Error("Không tìm thấy người dùng");
		// Get password
		const auth = await this.getOne({
			where: { user: user.id, auth_method: AuthMethods.OTP },
			attributes: ["auth_key"],
		});
		if (!auth) throw new Error("Chưa tạo mã OTP");
		if (!auth.compareKey(otp)) throw new Error("OTP không hợp lệ");
		/* Set expiration time to 3 min */
		if (dayjs().diff(dayjs(auth.created_at), "minute") > 3) throw new Error("OTP hết hạn");
		// Remove OTP from db and update is actvie to true
		await Promise.all([this.delete(auth.id), user.updateOne({ is_active: true })]);

		const // Set token
			tokenLife = dayjs().endOf("day").valueOf() - dayjs().valueOf(),
			tokenPayload = { id: user.id, isAdmin: user.is_admin } satisfies AuthPayload,
			tokenSecret = nconf.get("JWT:Secret"),
			tokenOptions = { expiresIn: tokenLife } satisfies SignOptions;

		return {
			accessToken: signJwt(tokenPayload, tokenSecret, tokenOptions),
			expiresIn: tokenLife,
		};
	}
}
