import BaseProvider from "#templates/base/baseProvider";
import { IUser, IUserMethods, collectionName, schema } from "#models/user";

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
}
