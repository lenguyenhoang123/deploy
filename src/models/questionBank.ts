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
		is_correct: { type: Boolean, required: false },
	},
	{ _id: true },
);
function arrayLimit(val: IAnswer[]) {
	return val.length <= 4 && val.length >= 2;
}

export interface IQuestionBank {
	_id?: ObjectId;
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
						// Auto-detect: essay if no is_correct in any answer
						const hasIsCorrect = val.some((a) => a.is_correct !== undefined && a.is_correct !== null);
						const isEssay = this.type === QuestionTypes.ESSAY || !hasIsCorrect;
						if (isEssay) {
							return val.length <= 1; // Essay: 0 or 1 answer
						}
						// MC: require 2-4 answers
						return val.length >= 2 && val.length <= 4;
					},
					message: "Tự luận tối đa 1 đáp án, trắc nghiệm phải có từ 2 đến 4 đáp án",
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

	// Pre-save hook to auto-detect type based on answers
	newSchema.pre("save", function (next) {
		const question = this as IQuestionBank;
		// Auto-detect essay if not explicitly set
		if (!question.type || question.type === QuestionTypes.MULTIPLE_CHOICE) {
			const hasIsCorrect = question.answers?.some(
				(a: IAnswer) => a.is_correct !== undefined && a.is_correct !== null
			);
			if (!hasIsCorrect) {
				question.type = QuestionTypes.ESSAY;
			}
		}
		next();
	});

	return newSchema;
})();
