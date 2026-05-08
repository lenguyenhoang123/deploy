import { Model, ObjectId, Schema } from "mongoose";
import { collectionName as learningContentCollection } from "./learningContent";
import { collectionName as userCollection } from "./user";

export interface ILearningProgress {
	user_id: ObjectId;
	content_id: ObjectId;
	status: "not_started" | "in_progress" | "completed";
	progress_percentage: number; // 0-100
	time_spent: number; // in minutes
	scroll_position?: number; // for tracking reading position
	last_position?: string; // last section/chapter read
	completed_at?: Date;
	created_at?: Date;
	updated_at?: Date;
}

export interface ILearningProgressMethods {}
export type LearningProgressModel = Model<ILearningProgress, {}, ILearningProgressMethods>;

export const collectionName = "learning_progress";
export const schema = (function () {
	const newSchema = new Schema<ILearningProgress, LearningProgressModel, ILearningProgressMethods>(
		{
			user_id: { type: Schema.Types.ObjectId, ref: userCollection, required: true },
			content_id: { type: Schema.Types.ObjectId, ref: learningContentCollection, required: true },
			status: {
				type: String,
				enum: ["not_started", "in_progress", "completed"],
				default: "not_started",
			},
			progress_percentage: { type: Number, default: 0, min: 0, max: 100 },
			time_spent: { type: Number, default: 0, min: 0 },
			scroll_position: { type: Number, default: 0 },
			last_position: { type: String },
			completed_at: { type: Date },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);

	newSchema.index({ user_id: 1, content_id: 1 }, { unique: true });
	newSchema.index({ user_id: 1, status: 1 });
	newSchema.index({ content_id: 1, status: 1 });

	return newSchema;
})();
