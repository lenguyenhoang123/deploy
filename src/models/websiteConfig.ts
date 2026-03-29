import { Model, ObjectId, Schema } from "mongoose";
import { collectionName as fileCollection, FileModel } from "./file";

export interface IProfileSchemaField {
	key: string;
	label: string;
	type: string;
	options?: string[];
	required?: boolean;
	unique?: boolean;
}

export interface IQuestionConfig {
	type: string;
	count: number;
}

export interface IExamRules {
	max_attempts: number;
	time_minutes: number;
	question_config: IQuestionConfig[];
	essay_grading: string;
}

export interface IClassificationRule {
	label: string;
	pattern: string;
}

export interface IUnitSchema {
	group_by_field: string;
	group_label: string;
	classification_field: string;
	classification_rules: IClassificationRule[];
}

export interface IWebsiteConfig {
	name?: string;
	phone?: string;
	email?: string;
	website?: string;
	address?: string;
	logo?: ObjectId | FileModel;
	banner?: ObjectId | FileModel;
	banners?: ObjectId[] | FileModel[];
	guide_video?: ObjectId | FileModel;
	theme?: string;
	is_default?: boolean;
	profile_schema?: IProfileSchemaField[];
	exam_rules?: IExamRules;
	unit_schema?: IUnitSchema;
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
			banners: [{ type: Schema.Types.ObjectId, ref: fileCollection }],
			guide_video: { type: Schema.Types.ObjectId, ref: fileCollection },
			theme: { type: String },
			is_default: { type: Boolean, default: false },
			profile_schema: [
				{
					key: { type: String, required: true },
					label: { type: String, required: true },
					type: { type: String, required: true, enum: ["text", "date", "select", "number"] },
					options: [{ type: String }],
					required: { type: Boolean },
					unique: { type: Boolean },
				},
			],
			exam_rules: {
				max_attempts: { type: Number },
				time_minutes: { type: Number },
				question_config: [
					{
						type: { type: String, enum: ["MULTIPLE_CHOICE", "ESSAY"] },
						count: { type: Number },
					},
				],
				essay_grading: { type: String, enum: ["manual", "auto"] },
			},
			unit_schema: {
				group_by_field: { type: String },
				group_label: { type: String },
				classification_field: { type: String },
				classification_rules: [
					{
						label: { type: String },
						pattern: { type: String },
					},
				],
			},
			created_by: { type: Schema.Types.ObjectId, Ref: collectionName },
			updated_by: { type: Schema.Types.ObjectId, Ref: collectionName },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);
	return newSchema;
})();
