import { capitalizeFirstLetter } from "#services/data-handlers/helperService";
import { Model, ObjectId, Schema } from "mongoose";
import { isEmail, isMobilePhone } from "validator";
export interface IUser {
	first_name: string;
	middle_name?: string;
	last_name: string;
	email: string;
	phone: string;
	unit: {
		district: string;
		ward: string;
	};
	is_admin?: boolean;
	is_active?: boolean;
	is_deleted?: boolean;
	created_at?: Date;
	created_by?: ObjectId;
	updated_at?: Date;
	updated_by?: ObjectId;
}
export interface IUserMethods {
	full_name(): string;
}
export type UserModel = Model<IUser, {}, IUserMethods>;

export const collectionName = "user";
export const schema = (function () {
	const newSchema = new Schema<IUser, UserModel, IUserMethods>(
		{
			first_name: {
				type: String,
				trim: true,
				required: [true, "Vui lòng nhập tên"],
			},
			middle_name: {
				type: String,
				trim: true,
			},
			last_name: {
				type: String,
				trim: true,
				required: [true, "Vui lòng nhập tên họ"],
			},
			email: {
				type: String,
				trim: true,
				lowercase: true,
				unique: true,
				required: [true, "Vui lòng nhập email"],
				validate: [isEmail, "Email không hợp lệ"],
			},
			phone: {
				type: String,
				lowercase: true,
				unique: true,
				required: [true, "Vui lòng nhập số điện thoại"],
				validate: [(value: string) => isMobilePhone(value, "vi-VN"), "Số điện thoại không hợp lệ"],
			},
			unit: {
				district: String,
				ward: String,
			},
			is_active: { type: Boolean, default: false },
			is_deleted: { type: Boolean, default: false },
			is_admin: { type: Boolean, default: false },
			created_by: { type: Schema.Types.ObjectId, Ref: collectionName },
			updated_by: { type: Schema.Types.ObjectId, Ref: collectionName },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);

	newSchema.method("full_name", function () {
		return [this.last_name, this.middle_name, this.first_name].filter((val) => val).join(" ");
	});

	newSchema.pre("save", function () {
		this.first_name = capitalizeFirstLetter(this.first_name);
		this.last_name = capitalizeFirstLetter(this.last_name);
		if (this.middle_name)
			this.middle_name = this.middle_name
				.split(" ")
				.map((val) => capitalizeFirstLetter(val))
				.join(" ");
	});

	return newSchema;
})();
