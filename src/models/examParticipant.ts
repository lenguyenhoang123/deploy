import { Model, ObjectId, Schema } from "mongoose";
import { collectionName as examCollection } from "./exam";
import { collectionName as userCollection } from "./user";
import { collectionName as questionBankCollection } from "./questionBank";

export interface IExamParticipantAnswer {
	question_id: ObjectId;
	user_answer?: ObjectId;
	text_answer?: string;
	is_correct?: boolean;
}

export interface IExamParticipant {
	exam_id: ObjectId;
	user_id: ObjectId;
	attempt_number: number;
	status: string;
	start_time?: Date;
	submit_time?: Date;
	score?: number;
	time_taken?: number;
	shuffled_questions: ObjectId[];
	shuffled_answers?: Record<string, any>;
	answers: IExamParticipantAnswer[];
	created_at?: Date;
	updated_at?: Date;
}

export enum ExamParticipantStatus {
	REGISTERED = "registered",
	IN_PROGRESS = "in_progress",
	SUBMITTED = "submitted",
}

export interface IExamParticipantMethods {}
export type ExamParticipantModel = Model<IExamParticipant, {}, IExamParticipantMethods>;

const examParticipantAnswerSchema = new Schema<IExamParticipantAnswer>(
	{
		question_id: { type: Schema.Types.ObjectId, ref: questionBankCollection, required: true },
		user_answer: { type: Schema.Types.ObjectId },
		text_answer: { type: String },
		is_correct: { type: Boolean },
	},
	{ _id: false },
);

export const collectionName = "exam_participant";
export const schema = (function () {
	const newSchema = new Schema<IExamParticipant, ExamParticipantModel, IExamParticipantMethods>(
		{
			exam_id: { type: Schema.Types.ObjectId, ref: examCollection, required: true },
			user_id: { type: Schema.Types.ObjectId, ref: userCollection, required: true },
			attempt_number: { type: Number, required: true, min: 1, max: 5 },
			status: {
				type: String,
				enum: Object.values(ExamParticipantStatus),
				default: ExamParticipantStatus.IN_PROGRESS,
				required: true,
			},
			start_time: { type: Date },
			submit_time: { type: Date },
			score: { type: Number },
			time_taken: { type: Number },
			shuffled_questions: [{ type: Schema.Types.ObjectId, ref: questionBankCollection }],
			shuffled_answers: { type: Schema.Types.Mixed },
			answers: { type: [examParticipantAnswerSchema], default: [] },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);

	newSchema.index({ exam_id: 1, user_id: 1 });
	newSchema.index({ exam_id: 1, user_id: 1, attempt_number: 1 }, { unique: true });
	newSchema.index({ exam_id: 1, status: 1 });
	newSchema.index({ exam_id: 1, score: -1, time_taken: 1 });

	return newSchema;
})();
