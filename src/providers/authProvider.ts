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
		const user = await this.userProvider.getOne({ where: { email }, attributes: ["id", "is_active", "is_admin"] });
		if (!user) throw new Error("Tài khoản không tồn tại");
		if (!user.is_active) throw new Error("Tài khoản chưa được kích hoạt");
		// Get password
		const auth = await this.getOne({
			where: { user: user.id, auth_method: AuthMethods.PASSWORD },
			attributes: ["auth_key"],
		});
		if (!auth) throw new Error("Chưa tạo mật khẩu");
		if (!auth.compareKey(password)) throw new Error("Mật khẩu không chính xác");
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
		const user = await this.userProvider.getOne({ where: { email }, attributes: ["id", "is_active", "is_admin"] });
		if (!user) throw new Error("Không tìm thấy người dùng");
		// Get password
		const auth = await this.getOne({
			where: { user: user.id, auth_method: AuthMethods.OTP },
			attributes: ["auth_key", "updated_at"],
		});
		if (!auth) throw new Error("Chưa tạo mã xác minh");
		if (!auth.compareKey(otp)) throw new Error("Mã xác minh không chính xác");
		/* Set expiration time to 1 min */
		if (dayjs().diff(dayjs(auth.updated_at), "minute") > 1) throw new Error("Mã xác minh đã hết hạn");
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
