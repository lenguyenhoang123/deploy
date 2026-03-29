import { Model, ObjectId, Schema } from "mongoose";
import { collectionName as fileCollection } from "./file";
import { collectionName as userCollection } from "./user";

export enum ContentPageType {
	EXAM_RULES = "exam_rules",
	REFERENCE_DOCS = "reference_docs",
	RESULTS = "results",
	CONTACT = "contact",
	ANNOUNCEMENT = "announcement",
}

export interface IContentPage {
	title: string;
	slug: string;
	type: string;
	content: string;
	sort_order?: number;
	is_active?: boolean;
	files?: ObjectId[];
	created_at?: Date;
	created_by?: ObjectId;
	updated_at?: Date;
	updated_by?: ObjectId;
}

export interface IContentPageMethods {}
export type ContentPageModel = Model<IContentPage, {}, IContentPageMethods>;

export const collectionName = "content_page";
export const schema = (function () {
	const newSchema = new Schema<IContentPage, ContentPageModel, IContentPageMethods>(
		{
			title: { type: String, required: true, minlength: 1, maxlength: 255 },
			slug: { type: String, required: true, unique: true },
			type: {
				type: String,
				enum: Object.values(ContentPageType),
				required: true,
			},
			content: { type: String, required: true },
			sort_order: { type: Number, default: 0 },
			is_active: { type: Boolean, default: true },
			files: [{ type: Schema.Types.ObjectId, ref: fileCollection }],
			created_by: { type: Schema.Types.ObjectId, ref: userCollection },
			updated_by: { type: Schema.Types.ObjectId, ref: userCollection },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);

	newSchema.index({ slug: 1 }, { unique: true });
	newSchema.index({ type: 1, sort_order: 1 });
	newSchema.index({ is_active: 1, type: 1 });

	return newSchema;
})();
