import BaseProvider from "#templates/base/baseProvider";
import { IExam, IExamMethods, collectionName, schema } from "#models/exam";
import { IAnswer } from "#models/questionBank";
import { ObjectId } from "mongoose";

export class ExamProvider extends BaseProvider<IExam, IExamMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	async getTemplateDetails(examId: string) {
		const exam = await this.getById(examId);
		if (!exam) throw new Error("Kỳ thi không tồn tại");

		const examDetail = await exam.populate({ path: "template.questions", select: "name level priority answers" });
		if (!exam) throw new Error("Có lỗi xảy ra khi lấy chi tiết đề thi");

		return {
			name: examDetail.template.name,
			questions: examDetail.template.questions,
			number_of_questions: examDetail.template.questions.length,
		};
	}
}
