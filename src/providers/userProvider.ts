import BaseProvider from "#templates/base/baseProvider";
import { IUser, IUserMethods, collectionName, schema } from "#models/user";
import { Req } from "#services/interfaces/iapi";
import { MeUError } from "../dto/MeUErrorDTO";
import { ObjectId } from "mongoose";

export class UserProvider extends BaseProvider<IUser, IUserMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	async getSystemAdmin() {
		return await this.getOne({
			where: {
				is_active: true,
				is_admin: true,
			},
		});
	}

	async getUserFromRequest(req: Req): Promise<any> {
		return this.handleUserRetrieval(req.user?.id);
	}

	async getUserIdFromRequest(req: Req): Promise<ObjectId> {
		const user = await this.handleUserRetrieval(req.user?.id);
		return user.id;
	}

	private async handleUserRetrieval(userId: string): Promise<any> {
		if (!userId) {
			throw new MeUError(401, "API", new Error("Lấy thông tin tài khoản thất bại!"));
		}

		const user = await this.getById(userId);
		if (!user) {
			throw new MeUError(404, "API", new Error("Người dùng không tồn tại"));
		}

		return user;
	}
}
