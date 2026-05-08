import { Model, ObjectId, Schema } from "mongoose";
import { collectionName as learningContentCollection } from "./learningContent";
import { collectionName as questionBankCollection } from "./questionBank";

export interface ILearningQuiz {
	content_id: ObjectId;
	title: string;
	description: string;
	passing_score: number; // absolute score (e.g., 16 points)
	total_score: number; // total possible score (e.g., 20 points)
	time_limit: number; // in minutes
	questions: ObjectId[]; // Reference to question_bank
	is_active: boolean;
	shuffle_questions: boolean;
	shuffle_answers: boolean;
	created_at?: Date;
	updated_at?: Date;
}

export interface ILearningQuizMethods {}
export type LearningQuizModel = Model<ILearningQuiz, {}, ILearningQuizMethods>;

export const collectionName = "learning_quiz";
export const schema = (function () {
	const newSchema = new Schema<ILearningQuiz, LearningQuizModel, ILearningQuizMethods>(
		{
			content_id: { 
				type: Schema.Types.ObjectId, 
				ref: learningContentCollection, 
				required: true,
				unique: true
			},
			title: { type: String, required: true, maxlength: 255 },
			description: { type: String, maxlength: 500 },
			passing_score: { 
				type: Number, 
				required: true, 
				min: 0, 
				default: 16 
			},
			total_score: { 
				type: Number, 
				required: true, 
				min: 0,
				default: 20 
			},
			time_limit: { type: Number, required: true, min: 1, default: 20 },
			questions: [{ type: Schema.Types.ObjectId, ref: questionBankCollection }],
			is_active: { type: Boolean, default: true },
			shuffle_questions: { type: Boolean, default: true },
			shuffle_answers: { type: Boolean, default: true },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);

	newSchema.index({ content_id: 1 }, { unique: true });
	newSchema.index({ is_active: 1 });

	return newSchema;
})();
