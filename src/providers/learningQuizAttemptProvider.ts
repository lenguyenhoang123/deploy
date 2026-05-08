import BaseProvider from "#templates/base/baseProvider";
import { ILearningQuizAttempt, ILearningQuizAttemptMethods, collectionName, schema } from "#models/learningQuizAttempt";

export class LearningQuizAttemptProvider extends BaseProvider<ILearningQuizAttempt, ILearningQuizAttemptMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	async getUserAttempts(userId: string, quizId: string) {
		return await this.getAll({
			where: { user_id: userId, quiz_id: quizId },
			sortField: "attempt_number",
			sortOrder: "desc",
			includes: [
				{ path: "quiz_id", select: "title passing_score time_limit" }
			]
		});
	}

	async getCurrentAttempt(userId: string, quizId: string) {
		return await this.getOne({
			where: { 
				user_id: userId, 
				quiz_id: quizId, 
				status: "in_progress" 
			},
			includes: [
				{ path: "shuffled_questions", select: "name type answers" }
			]
		});
	}

	async createAttempt(userId: string, quizId: string, attemptNumber: number, shuffledQuestions: string[], shuffledAnswers?: Record<string, string[]>) {
		return await this.post({
			user_id: userId as any,
			quiz_id: quizId as any,
			attempt_number: attemptNumber,
			status: "in_progress",
			start_time: new Date(),
			shuffled_questions: shuffledQuestions as any,
			shuffled_answers: shuffledAnswers as any,
			answers: [],
		});
	}

	async submitAttempt(attemptId: string, answers: any[], timeTaken: number, score: number, passed: boolean) {
		// Convert ObjectIds to strings in answers to avoid MongoDB validation errors
		const processedAnswers = answers.map((answer: any) => ({
			question_id: answer.question_id?.toString?.() || answer.question_id,
			user_answer: answer.user_answer?.toString?.() || answer.user_answer,
			text_answer: answer.text_answer,
			is_correct: answer.is_correct
		}));

		const updateData = {
			status: passed ? "completed" : "failed",
			end_time: new Date(),
			time_taken: timeTaken,
			score: score,
			passed: passed,
			answers: processedAnswers,
		};

		return await this.put(attemptId, updateData);
	}

	async getAttemptById(attemptId: string) {
		return await this.getOne({
			where: { _id: attemptId },
			includes: [
				{ path: "quiz_id", select: "_id title passing_score time_limit" }
				// Không populate shuffled_questions để giữ ObjectId strings
			]
		});
	}

	async getPassedAttempts(userId: string) {
		return await this.getAll({
			where: { user_id: userId, passed: true },
			sortField: "created_at",
			sortOrder: "desc",
			includes: [
				{ path: "quiz_id", select: "title" }
			]
		});
	}
}
