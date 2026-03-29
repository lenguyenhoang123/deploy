import { Model, ObjectId, Schema } from "mongoose";
import { collectionName as fileCollection, FileModel } from "./file";

export enum DifficultyLevels {
	EASY = "EASY",
	NORMAL = "NORMAL",
	HARD = "HARD",
}

export enum QuestionTypes {
	MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
	ESSAY = "ESSAY",
}

export interface IAnswer {
	_id: ObjectId;
	value: string;
	is_correct?: boolean;
}
const answerSchema = new Schema<IAnswer>(
	{
		value: { type: String, required: true },
		is_correct: { type: Boolean, required: true },
	},
	{ _id: true },
);
function arrayLimit(val: IAnswer[]) {
	return val.length <= 4 && val.length >= 2;
}

export interface IQuestionBank {
	name: string;
	type: string;
	level: string;
	priority: number;
	files?: ObjectId[] | FileModel[];
	answers: IAnswer[];
	is_deleted?: boolean;
	created_at?: Date;
	created_by?: ObjectId;
	updated_at?: Date;
	updated_by?: ObjectId;
}
export interface IQuestionBankMethods {}
export type QuestionBankModel = Model<IQuestionBank, {}, IQuestionBankMethods>;

export const collectionName = "question_bank";
export const schema = (function () {
	const newSchema = new Schema<IQuestionBank, QuestionBankModel, IQuestionBankMethods>(
		{
			name: { type: String, required: true },
			type: {
				type: String,
				enum: Object.values(QuestionTypes),
				default: QuestionTypes.MULTIPLE_CHOICE,
				required: true,
			},
			level: {
				type: String,
				enum: Object.values(DifficultyLevels),
				required: true,
			},
			priority: { type: Number, required: true },
			files: [{ type: Schema.Types.ObjectId, ref: fileCollection }],
			answers: {
				type: [answerSchema],
				validate: {
					validator: function (this: IQuestionBank, val: IAnswer[]) {
						if (this.type === QuestionTypes.ESSAY) return true;
						return val.length >= 2 && val.length <= 4;
					},
					message: "Mỗi câu hỏi trắc nghiệm phải có từ 2 đến 4 đáp án",
				},
			},
			is_deleted: { type: Boolean, default: false },
			created_by: { type: Schema.Types.ObjectId, Ref: collectionName },
			updated_by: { type: Schema.Types.ObjectId, Ref: collectionName },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);
	return newSchema;
})();
