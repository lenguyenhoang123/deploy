import BaseProvider from "#templates/base/baseProvider";
import mongoose from "mongoose";
import { ILearningQuiz, ILearningQuizMethods, collectionName, schema } from "#models/learningQuiz";

export class LearningQuizProvider extends BaseProvider<ILearningQuiz, ILearningQuizMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	async getQuizByContentId(contentId: string) {
		return await this.getOne({
			where: { content_id: contentId },
			includes: [
				{ path: "questions", select: "name type level answers" }
			]
		});
	}

	async getQuizWithDetails(quizId: string) {
		return await this.getOne({
			where: { _id: quizId, is_active: true },
			includes: [
				{ path: "content_id", select: "title description" },
				{ path: "questions", select: "name type level answers" }
			]
		});
	}

	async createQuiz(data: Omit<ILearningQuiz, "created_at" | "updated_at">) {
		return await this.post({
			...data,
			content_id: data.content_id,
			questions: data.questions,
		});
	}

	async updateQuiz(quizId: string, updates: Partial<ILearningQuiz>) {
		return await this.put(quizId, updates);
	}

	async getActiveQuizzes() {
		return await this.getAll({
			where: { is_active: true },
			includes: [
				{ path: "content_id", select: "title description" },
				{ path: "questions", select: "name type level" }
			]
		});
	}
}
