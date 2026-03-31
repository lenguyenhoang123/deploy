import { Model, ObjectId, Schema } from "mongoose";
import { collectionName as QuestionBankCollection, QuestionBankModel } from "./questionBank";

export interface IParticipantAnswer {
	question_id: ObjectId;
	user_answer?: ObjectId;
	question_answers: ObjectId[];
}

export interface IParticipant {
	_id: ObjectId;
	user_id: ObjectId;
	attempt_count: number;
	start_time: Date;
	submit_time: Date;
	answers: IParticipantAnswer[];
	template_id?: ObjectId;
}

export interface ITemplate {
	_id: ObjectId;
	name: string;
	questions: ObjectId[] | QuestionBankModel[];
}

export interface IExam {
	name: string;
	description?: string;
	start_time: Date;
	end_time: Date;
	allowed_time: number;
	max_attempts: number;
	templates: ITemplate[];
	participants: IParticipant[];
	created_at?: Date;
	created_by?: ObjectId;
	updated_at?: Date;
	updated_by?: ObjectId;
}
export interface IExamMethods {}
export type ExamModel = Model<IExam, {}, IExamMethods>;

const participantAnswerSchema = new Schema<IParticipantAnswer>(
	{
		question_id: { type: Schema.Types.ObjectId, required: true },
		user_answer: { type: Schema.Types.ObjectId },
		question_answers: {
			type: [{ type: Schema.Types.ObjectId }],
			required: true,
		},
	},
	{ _id: false },
);

const participantSchema = new Schema<IParticipant>(
	{
		user_id: { type: Schema.Types.ObjectId, required: true },
		attempt_count: { type: Number, default: 0, min: 0 },
		start_time: { type: Date, required: true },
		submit_time: { type: Date, required: true },
		answers: { type: [participantAnswerSchema], required: true },
		template_id: { type: Schema.Types.ObjectId },
	},
	{ _id: false },
);

const templateSchema = new Schema<ITemplate>(
	{
		name: { type: String, required: true },
		questions: {
			type: [{ type: Schema.Types.ObjectId, ref: QuestionBankCollection }],
			required: true,
		},
	},
	{ _id: true },
);

export const collectionName = "exam";
export const schema = (function () {
	const newSchema = new Schema<IExam, ExamModel, IExamMethods>(
		{
			name: { type: String, required: true },
			description: { type: String },
			start_time: { type: Date, required: true },
			end_time: { type: Date, required: true },
			allowed_time: { type: Number, required: true, min: 1 },
			max_attempts: { type: Number, required: true, min: 1 },
			templates: { type: [templateSchema] },
			participants: { type: [participantSchema] },
			created_by: { type: Schema.Types.ObjectId, Ref: collectionName },
			updated_by: { type: Schema.Types.ObjectId, Ref: collectionName },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);
	return newSchema;
})();
