import BaseProvider from "#templates/base/baseProvider";
import { IExam, IExamMethods, collectionName, schema } from "#models/exam";
import { IAnswer } from "#models/questionBank";
import { ObjectId } from "mongoose";

export class ExamProvider extends BaseProvider<IExam, IExamMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	private extractAnswerValues(answers: IAnswer[]): { _id: ObjectId; value: string }[] {
		return answers.map((answer) => ({
			_id: answer._id,
			value: answer.value,
		}));
	}

	async getTemplateDetails(examId: string) {
		const exam = await this.getById(examId);
		if (!exam) throw new Error("Kỳ thi không tồn tại");

		const examDetail = await exam.populate({ path: "template.questions", select: "name answers" });
		if (!exam) throw new Error("Có lỗi xảy ra khi lấy chi tiết đề thi");

		const questions = examDetail.template.questions.map((question) => ({
			...question.toObject(),
			answers: this.extractAnswerValues(question.answers),
		}));

		return {
			exam_name: exam.name,
			allowed_time: exam.allowed_time,
			template_name: examDetail.template.name,
			quantity: questions.length,
			questions: questions,
		};
	}
}
