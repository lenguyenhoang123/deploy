import { Model, ObjectId, Schema } from "mongoose";
import { collectionName as fileCollection } from "./file";
import { collectionName as userCollection } from "./user";

export enum LearningContentType {
	READING_MATERIAL = "reading_material",
	VIDEO_CONTENT = "video_content",
	INTERACTIVE_CONTENT = "interactive_content",
}

export interface ILearningContent {
	title: string;
	description: string;
	type: LearningContentType;
	content: string; // HTML content for reading materials
	file_id?: ObjectId; // For DOCX files
	estimated_reading_time: number; // in minutes
	difficulty_level: "easy" | "medium" | "hard";
	tags: string[];
	is_active: boolean;
	sort_order?: number;
	slug?: string; // URL-friendly identifier
	created_by?: ObjectId;
	updated_by?: ObjectId;
	created_at?: Date;
	updated_at?: Date;
}

export interface ILearningContentMethods {}
export type LearningContentModel = Model<ILearningContent, {}, ILearningContentMethods>;

export const collectionName = "learning_content";
export const schema = (function () {
	const newSchema = new Schema<ILearningContent, LearningContentModel, ILearningContentMethods>(
		{
			title: { type: String, required: true, minlength: 1, maxlength: 255 },
			description: { type: String, required: true, maxlength: 500 },
			type: {
				type: String,
				enum: Object.values(LearningContentType),
				required: true,
			},
			content: { type: String, required: true }, // HTML content
			file_id: { type: Schema.Types.ObjectId, ref: fileCollection },
			estimated_reading_time: { type: Number, required: true, min: 1 },
			difficulty_level: {
				type: String,
				enum: ["easy", "medium", "hard"],
				default: "medium",
			},
			tags: [{ type: String, trim: true }],
			is_active: { type: Boolean, default: true },
			sort_order: { type: Number, default: 0 },
			slug: { type: String, unique: true, sparse: true }, // sparse allows null values
			created_by: { type: Schema.Types.ObjectId, ref: userCollection },
			updated_by: { type: Schema.Types.ObjectId, ref: userCollection },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);

	newSchema.index({ type: 1, sort_order: 1 });
	newSchema.index({ is_active: 1, status: 1 });
	newSchema.index({ tags: 1 });
	newSchema.index({ difficulty_level: 1 });

	return newSchema;
})();
