import { Model, Schema, Types } from "mongoose";

// Export ObjectId constructor and type for consistency
export const ObjectId = Types.ObjectId;
export type ObjectId = Types.ObjectId;

export interface ICertificateConditions {
	min_score: number;
	require_all_correct: boolean;
	completion_required: boolean;
}

export interface ICertificateLayout {
	font_family: string;
	primary_color: string;
	secondary_color: string;
}

export interface ICertificateContent {
	show_score: boolean;
	show_rank: boolean;
	show_completion_date: boolean;
	show_exam_name: boolean;
}

export interface ICertificateSignature {
	name: string;
	title: string;
	signature_image?: ObjectId;
	position: "left" | "center" | "right";
}

export interface ICertificateTemplate {
	_id?: ObjectId;
	exam_id?: ObjectId;
	name: string;
	is_enabled: boolean;
	conditions: ICertificateConditions;
	design: {
		logo?: ObjectId;
		background?: ObjectId;
		title: string;
		subtitle?: string;
		layout: ICertificateLayout;
		content: ICertificateContent;
		signatures: ICertificateSignature[];
	};
	legal_text?: string;
	created_at?: Date;
	created_by?: ObjectId;
	updated_at?: Date;
	updated_by?: ObjectId;
}

export interface ICertificateTemplateMethods {}
export type CertificateTemplateModel = Model<ICertificateTemplate, {}, ICertificateTemplateMethods>;

const conditionsSchema = new Schema<ICertificateConditions>(
	{
		min_score: { type: Number, required: true, min: 0, max: 100 },
		require_all_correct: { type: Boolean, default: false },
		completion_required: { type: Boolean, default: true },
	},
	{ _id: false },
);

const layoutSchema = new Schema<ICertificateLayout>(
	{
		font_family: { type: String, default: "Times New Roman" },
		primary_color: { type: String, default: "#1a5fb4" },
		secondary_color: { type: String, default: "#333333" },
	},
	{ _id: false },
);

const contentSchema = new Schema<ICertificateContent>(
	{
		show_score: { type: Boolean, default: true },
		show_rank: { type: Boolean, default: false },
		show_completion_date: { type: Boolean, default: true },
		show_exam_name: { type: Boolean, default: true },
	},
	{ _id: false },
);

const signatureSchema = new Schema<ICertificateSignature>(
	{
		name: { type: String, required: true },
		title: { type: String, required: true },
		signature_image: { type: Schema.Types.ObjectId },
		position: { type: String, enum: ["left", "center", "right"], default: "center" },
	},
	{ _id: false },
);

export const collectionName = "certificate_template";
export const schema = (function () {
	const newSchema = new Schema<ICertificateTemplate, CertificateTemplateModel, ICertificateTemplateMethods>(
		{
			exam_id: { type: Schema.Types.ObjectId, unique: true, sparse: true },
			name: { type: String, required: true },
			is_enabled: { type: Boolean, default: false },
			conditions: { type: conditionsSchema, required: true },
			design: {
				logo: { type: Schema.Types.ObjectId },
				background: { type: Schema.Types.ObjectId },
				title: { type: String, default: "CHỨNG CHỈ HOÀN THÀNH" },
				subtitle: { type: String, default: "Kỳ thi trực tuyến" },
				layout: { type: layoutSchema, default: () => ({}) },
				content: { type: contentSchema, default: () => ({}) },
				signatures: { type: [signatureSchema], default: [] },
			},
			legal_text: { type: String },
			created_by: { type: Schema.Types.ObjectId },
			updated_by: { type: Schema.Types.ObjectId },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);
	return newSchema;
})();
