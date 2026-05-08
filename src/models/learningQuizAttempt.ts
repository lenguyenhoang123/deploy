import { Model, ObjectId, Schema } from "mongoose";
import { collectionName as learningQuizCollection } from "./learningQuiz";
import { collectionName as userCollection } from "./user";
import { collectionName as questionBankCollection } from "./questionBank";

export interface ILearningQuizAnswer {
	question_id: ObjectId;
	user_answer?: ObjectId;
	text_answer?: string;
	is_correct?: boolean;
}

export interface ILearningQuizAttempt {
	user_id: ObjectId;
	quiz_id: ObjectId;
	attempt_number: number;
	status: "in_progress" | "completed" | "failed";
	start_time: Date;
	end_time?: Date;
	time_taken?: number; // in minutes
	score?: number; // percentage 0-100
	passed?: boolean;
	shuffled_questions: ObjectId[];
	shuffled_answers?: Record<string, ObjectId[]>;
	answers: ILearningQuizAnswer[];
	certificate_generated?: boolean;
	created_at?: Date;
	updated_at?: Date;
}

export interface ILearningQuizAttemptMethods {}
export type LearningQuizAttemptModel = Model<ILearningQuizAttempt, {}, ILearningQuizAttemptMethods>;

const quizAnswerSchema = new Schema<ILearningQuizAnswer>(
	{
		question_id: { type: Schema.Types.ObjectId, ref: questionBankCollection, required: true },
		user_answer: { type: Schema.Types.ObjectId },
		text_answer: { type: String },
		is_correct: { type: Boolean },
	},
	{ _id: false },
);

export const collectionName = "learning_quiz_attempt";
export const schema = (function () {
	const newSchema = new Schema<ILearningQuizAttempt, LearningQuizAttemptModel, ILearningQuizAttemptMethods>(
		{
			user_id: { type: Schema.Types.ObjectId, ref: userCollection, required: true },
			quiz_id: { type: Schema.Types.ObjectId, ref: learningQuizCollection, required: true },
			attempt_number: { type: Number, required: true, min: 1 },
			status: {
				type: String,
				enum: ["in_progress", "completed", "failed"],
				default: "in_progress",
			},
			start_time: { type: Date, required: true },
			end_time: { type: Date },
			time_taken: { type: Number },
			score: { type: Number, min: 0, max: 100 },
			passed: { type: Boolean },
			shuffled_questions: [{ type: Schema.Types.ObjectId, ref: questionBankCollection }],
			shuffled_answers: { type: Schema.Types.Mixed },
			answers: { type: [quizAnswerSchema], default: [] },
			certificate_generated: { type: Boolean, default: false },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);

	newSchema.index({ user_id: 1, quiz_id: 1 });
	newSchema.index({ user_id: 1, quiz_id: 1, attempt_number: 1 }, { unique: true });
	newSchema.index({ quiz_id: 1, status: 1 });
	newSchema.index({ user_id: 1, status: 1 });

	return newSchema;
})();
