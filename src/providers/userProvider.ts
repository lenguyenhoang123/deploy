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
		const user = await this.handleUserRetrieval(req.user?.id);
		if (!user) throw new Error("Có lỗi xảy ra khi lấy thông tin tài khoản");
		return user;
	}

	async getUserIdFromRequest(req: Req): Promise<ObjectId> {
		const user = await this.handleUserRetrieval(req.user?.id);
		if (!user || !user.id) throw new Error("Có lỗi xảy ra khi lấy thông tin tài khoản");
		return user.id;
	}

	private async handleUserRetrieval(userId: string): Promise<any> {
		if (!userId) {
			throw new Error("Không tìm thấy User ID");
		}

		const user = await this.getById(userId);
		if (!user) {
			throw new Error("Tài khoản không tồn tại");
		}

		return user;
	}
}
