import BaseProvider from "#templates/base/baseProvider";
import {
	IExamParticipant,
	IExamParticipantMethods,
	IExamParticipantAnswer,
	collectionName,
	schema,
	ExamParticipantStatus,
} from "#models/examParticipant";
import { IQuestionBank, QuestionTypes } from "#models/questionBank";
import mongoose, { ObjectId } from "mongoose";

export class ExamParticipantProvider extends BaseProvider<IExamParticipant, IExamParticipantMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	async validateAndFetchParticipant(examId: string, userId: string, attemptNumber: number) {
		if (!mongoose.Types.ObjectId.isValid(examId)) {
			throw new Error("Exam ID không hợp lệ");
		}

		const participant = await this.getOne({
			where: {
				exam_id: new mongoose.Types.ObjectId(examId),
				user_id: new mongoose.Types.ObjectId(userId),
				attempt_number: attemptNumber,
			},
		});

		if (!participant) {
			throw new Error("Bạn chưa đăng ký kỳ thi này hoặc lượt thi không tồn tại");
		}

		return participant;
	}

	async getParticipantByExamAndUser(examId: string, userId: string, attemptNumber?: number) {
		const where: any = {
			exam_id: new mongoose.Types.ObjectId(examId),
			user_id: new mongoose.Types.ObjectId(userId),
		};

		if (attemptNumber !== undefined) {
			where.attempt_number = attemptNumber;
		}

		return await this.getOne({ where });
	}

	async getLatestAttempt(examId: string, userId: string) {
		const participants = await this.getAll({
			where: {
				exam_id: new mongoose.Types.ObjectId(examId),
				user_id: new mongoose.Types.ObjectId(userId),
			},
			sortField: "attempt_number",
			sortOrder: "desc",
			pageSize: 1,
			currentPage: 1,
		});

		return participants.rows[0] || null;
	}

	async getAttemptsCount(examId: string, userId: string): Promise<number> {
		const result = await this.getAll({
			where: {
				exam_id: new mongoose.Types.ObjectId(examId),
				user_id: new mongoose.Types.ObjectId(userId),
			},
			pageSize: 1,
			currentPage: 1,
		});
		return result.count;
	}

	async createNewAttempt(data: {
		exam_id: ObjectId;
		user_id: ObjectId;
		attempt_number: number;
		questions: ObjectId[];
		shuffled_answers?: Record<string, any>;
		start_time?: Date;
	}) {
		return await this.post({
			...data,
			status: ExamParticipantStatus.IN_PROGRESS,
			answers: [],
		});
	}

	calculateTimeTakenInMinutes(startTime: Date, submitTime: Date): number {
		const diffMs = submitTime.getTime() - startTime.getTime();
		return Math.round((diffMs / (1000 * 60)) * 100) / 100; // Round to 2 decimal places
	}

	isAnswerCorrect(question: IQuestionBank, userAnswer: ObjectId | undefined): boolean {
		if (!userAnswer) return false;
		return question.answers.some((a) => a._id.toString() === userAnswer.toString() && a.is_correct);
	}

	calculateScore(
		answers: IExamParticipantAnswer[],
		questionsMap: Map<string, IQuestionBank>,
	): { score: number; correctCount: number; processedAnswers: IExamParticipantAnswer[] } {
		let correctCount = 0;
		const processedAnswers: IExamParticipantAnswer[] = [];

		for (const answer of answers) {
			const question = questionsMap.get(answer.question_id.toString());
			if (!question) {
				processedAnswers.push(answer);
				continue;
			}

			const processedAnswer: IExamParticipantAnswer = { ...answer };

			// For multiple choice questions, check correctness
			if (question.type === QuestionTypes.MULTIPLE_CHOICE) {
				const isCorrect = this.isAnswerCorrect(question, answer.user_answer);
				processedAnswer.is_correct = isCorrect;
				if (isCorrect) {
					correctCount++;
				}
			}
			// For essay questions, text_answer is already stored, is_correct remains null until graded

			processedAnswers.push(processedAnswer);
		}

		return { score: correctCount, correctCount, processedAnswers };
	}

	async submitExam(
		examId: string,
		userId: string,
		attemptNumber: number,
		data: {
			start_time: Date;
			submit_time: Date;
			answers: IExamParticipantAnswer[];
			questionsMap: Map<string, IQuestionBank>;
		},
	) {
		const { start_time, submit_time, answers, questionsMap } = data;

		// Calculate time taken
		const timeTaken = this.calculateTimeTakenInMinutes(start_time, submit_time);

		// Calculate score and process answers
		const { score, processedAnswers } = this.calculateScore(answers, questionsMap);

		// Update participant record
		const participant = await this.getParticipantByExamAndUser(examId, userId, attemptNumber);
		if (!participant) {
			throw new Error("Không tìm thấy thông tin lượt thi");
		}

		const updateData = {
			status: ExamParticipantStatus.SUBMITTED,
			start_time,
			submit_time,
			time_taken: timeTaken,
			score,
			answers: processedAnswers,
		};

		const result = await this.put(participant._id!.toString(), updateData);
		return { result, score, timeTaken };
	}

	async getParticipantWithPopulatedQuestions(participantId: string) {
		const participant = await this.getById(participantId, {
			includes: [
				{ path: "questions", select: "name type answers files" },
				{ path: "exam_id", select: "name allowed_time" },
				{ path: "user_id", select: "first_name last_name middle_name email phone" },
			],
		});
		if (!participant) return null;
		// Return plain object without internal Mongoose properties
		return participant.toObject?.() || participant;
	}

	async getAllAttemptsByExamAndUser(examId: string, userId: string) {
		const result = await this.getAll({
			where: {
				exam_id: new mongoose.Types.ObjectId(examId),
				user_id: new mongoose.Types.ObjectId(userId),
				status: ExamParticipantStatus.SUBMITTED,
			},
			sortField: "attempt_number",
			sortOrder: "asc",
			pageSize: 100,
			currentPage: 1,
		});
		return result.rows;
	}

	/**
	 * Get total participants and attempts statistics
	 * Returns unique user count and total attempts count
	 */
	async getTotalParticipantsStats(): Promise<{ total_participants: number; total_attempts: number }> {
		const collection = this.getCollection();

		// Count total unique users (participants)
		const uniqueUsersResult = await collection.distinct("user_id", { status: "submitted" });
		const total_participants = uniqueUsersResult.length;

		// Count total submitted attempts
		const total_attempts = await collection.countDocuments({ status: "submitted" });

		return {
			total_participants,
			total_attempts,
		};
	}

	/**
	 * Update essay scores for a participant's answers
	 * @param currentAnswers - Current answers array from participant
	 * @param essayScores - Array of {question_id, score, is_correct?} for essay questions
	 * @returns Object with new total score and updated answers array
	 */
	updateEssayScores(
		currentAnswers: IExamParticipantAnswer[],
		essayScores: { question_id: string; score: number; is_correct?: boolean }[]
	): { newScore: number; updatedAnswers: IExamParticipantAnswer[] } {
		const scoresMap = new Map<string, { score: number; is_correct?: boolean }>();
		for (const s of essayScores) {
			scoresMap.set(s.question_id, {
				score: s.score,
				is_correct: s.is_correct ?? s.score > 0, // Mặc định true nếu có điểm > 0
			});
		}

		// Update answers with essay scores
		const updatedAnswers = currentAnswers.map((answer) => {
			const essayScoreData = scoresMap.get(answer.question_id.toString());
			if (essayScoreData !== undefined) {
				return {
					...answer,
					score: essayScoreData.score,
					is_correct: essayScoreData.is_correct,
				};
			}
			return answer;
		});

		// Recalculate total score (MC questions: 1 điểm nếu đúng, Essay: theo score nhập vào)
		let newScore = 0;
		for (const answer of updatedAnswers) {
			if (answer.score !== undefined) {
				// Câu tự luận: cộng theo điểm đã nhập
				newScore += answer.score;
			} else if (answer.is_correct === true) {
				// Câu trắc nghiệm: 1 điểm nếu đúng
				newScore += 1;
			}
		}

		return { newScore, updatedAnswers };
	}
}

export default ExamParticipantProvider;
