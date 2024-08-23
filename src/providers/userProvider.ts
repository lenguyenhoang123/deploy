import BaseProvider from "#templates/base/baseProvider";
import { IUser, IUserMethods, collectionName, schema } from "#models/user";
import mongoose from "mongoose";
import { capitalizeFirstLetter } from "#services/data-handlers/helperService";

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

	async validateAndFetchUser(
		userId: string,
		validateActive: boolean = true,
		validateDeleted: boolean = true,
		entityName: string = "tài khoản",
	): Promise<IUser | any> {
		await this.validateUserId(userId, validateActive, validateDeleted, entityName);
		return this.getById(userId);
	}

	async validateAndFetchUserId(
		userId: string,
		validateActive: boolean = true,
		validateDeleted: boolean = true,
		entityName: string = "tài khoản",
	) {
		await this.validateUserId(userId, validateActive, validateDeleted, entityName);
		const user = await this.getById(userId);
		return user.id;
	}

	async validateUserId(
		userId: string,
		validateActive: boolean = true,
		validateDeleted: boolean = true,
		entityName: string = "tài khoản",
	): Promise<void> {
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw new Error("User ID không hợp lệ");
		}

		const user = await this.getById(userId);
		this.validateUser(user, validateActive, validateDeleted, entityName);
	}

	validateUser(
		user: IUser | undefined,
		validateActive: boolean = true,
		validateDeleted: boolean = true,
		entityName: string = "tài khoản",
	): void {
		if (!user) {
			throw new Error(`Không tìm thấy ${entityName}`);
		}

		if (validateDeleted && user.is_deleted) {
			throw new Error(`${capitalizeFirstLetter(entityName)} đã bị xóa khỏi hệ thống`);
		}

		if (validateActive && !user.is_active) {
			throw new Error(`${capitalizeFirstLetter(entityName)} chưa được kích hoạt`);
		}
	}
}
