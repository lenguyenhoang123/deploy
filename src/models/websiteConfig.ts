import { Model, ObjectId, Schema } from "mongoose";

export interface IWebsiteConfig {
	name?: string;
	phone?: string;
	email?: string;
	website?: string;
	address?: string;
	logo?: string;
	banner?: string;
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
			logo: { type: String },
			banner: { type: String },
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
