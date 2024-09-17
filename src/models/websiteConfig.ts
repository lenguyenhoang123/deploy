import { Model, ObjectId, Schema } from "mongoose";
import { collectionName as fileCollection, FileModel } from "./file";

export interface IWebsiteConfig {
	name?: string;
	phone?: string;
	email?: string;
	website?: string;
	address?: string;
	logo?: ObjectId | FileModel;
	banner?: ObjectId | FileModel;
	theme?: string;
	is_default?: boolean;
	created_at?: Date;
	created_by?: ObjectId;
	updated_at?: Date;
	updated_by?: ObjectId;
}
export interface IWebsiteConfigMethods {}
export type WebsiteConfigModel = Model<IWebsiteConfig, {}, IWebsiteConfigMethods>;

export const collectionName = "website_config";
export const schema = (function () {
	const newSchema = new Schema<IWebsiteConfig, WebsiteConfigModel, IWebsiteConfigMethods>(
		{
			name: { type: String },
			phone: { type: String },
			email: { type: String },
			website: { type: String },
			address: { type: String },
			logo: { type: Schema.Types.ObjectId, ref: fileCollection },
			banner: { type: Schema.Types.ObjectId, ref: fileCollection },
			theme: { type: String },
			is_default: { type: Boolean, default: false },
			created_by: { type: Schema.Types.ObjectId, Ref: collectionName },
			updated_by: { type: Schema.Types.ObjectId, Ref: collectionName },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);
	return newSchema;
})();
