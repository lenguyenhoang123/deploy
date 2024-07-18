import { Model, ObjectId, Schema } from "mongoose";
import { compareSync, genSaltSync, hashSync } from "bcryptjs";
import { collectionName as userCollection, UserModel } from "./user";
import dayjs from "dayjs";
export interface IUserAuth {
	user: ObjectId | UserModel;
	auth_key: string;
	auth_method: string;
	created_at?: Date;
	updated_at?: Date;
}

export interface IUserAuthMethods {
	hashKey(key: string): string;
	compareKey(key: string): boolean;
}

export enum AuthMethods {
	PASSWORD = "PASSWORD",
	OTP = "OTP",
}

export type UserAuthModel = Model<IUserAuth, {}, IUserAuthMethods>;
//
export const collectionName = "user_auth";
export const schema = (function () {
	const newSchema = new Schema<IUserAuth, {}, IUserAuthMethods>(
		{
			user: { type: Schema.Types.ObjectId, ref: userCollection },
			auth_key: { type: String, required: true },
			auth_method: { type: String, enum: ["PASSWORD", "OTP"], required: true },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);
	newSchema.method("hashKey", function (key: string) {
		const salt = genSaltSync();
		return hashSync(key, salt);
	});
	newSchema.method("compareKey", function (key: string) {
		return compareSync(key, this.auth_key);
	});

	// Pre middleware
	newSchema.pre("insertMany", async function (_err, docs: Array<IUserAuth>, next) {
		docs.forEach((doc) => {
			const salt = genSaltSync();
			doc.auth_key = hashSync(doc.auth_key, salt);
		});
		return Promise.resolve();
	});

	newSchema.pre("updateOne", async function () {
		const getUpdate = this.getUpdate() as any;
		if (getUpdate && getUpdate.auth_key) {
			const docToUpdate = await this.model.findOne(this.getQuery());
			if (docToUpdate) {
				const salt = genSaltSync();
				docToUpdate.auth_key = hashSync(getUpdate.auth_key, salt);
				docToUpdate.updated_at = dayjs();
				this.setUpdate(docToUpdate);
			}
		}
		return Promise.resolve();
	});

	newSchema.pre("save", function () {
		this.auth_key = this.hashKey(this.auth_key);
	});
	return newSchema;
})();
