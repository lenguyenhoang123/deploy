import BaseProvider from "#templates/base/baseProvider";
import { IExam, IExamMethods, collectionName, schema, IParticipantAnswer, IParticipant } from "#models/exam";
import { IAnswer, IQuestionBank } from "#models/questionBank";
import mongoose, { ObjectId } from "mongoose";
import {
	IResult,
	IUnitStatistics,
	IParticipantStatistics,
	IQueryOptions,
	IPaginationResult,
} from "#services/interfaces/istatistics";
import { UserProvider } from "#providers/userProvider";
import { QuestionBankProvider } from "#providers/questionBankProvider";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";
import { applyFilters, applyPagination, applySorting, generatePaginationResult } from "#services/statisticsService";
import { WebsiteConfigProvider } from "#providers/websiteConfigProvider"
import { IFile } from "#models/file";
const userProvider = new UserProvider();
const questionBankProvider = new QuestionBankProvider();
const examParticipantProvider = new ExamParticipantProvider();

interface IFormattedQuestion {
	_id: ObjectId;
	name: string;
	answers: IAnswer[];
	files?: IFile[];
	user_answer?: ObjectId;
	is_correct?: boolean;
}

export class ExamProvider extends BaseProvider<IExam, IExamMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	async validateAndFetchExam(examId: string) {
		if (!mongoose.Types.ObjectId.isValid(examId)) {
			throw new Error("Exam ID không hợp lệ");
		}

		const exam = await this.getById(examId);
		if (!exam) {
			throw new Error("Kỳ thi không tồn tại");
		}

		return exam;
	}

	private extractAnswerValues(answers: IAnswer[], includeCorrect = false) {
		return answers.map(({ _id, value, is_correct }) => (includeCorrect ? { _id, value, is_correct } : { _id, value }));
	}

	private getAnswerById(answers: IAnswer[], id: ObjectId, includeCorrect = false): IAnswer | undefined {
		const { _id, value, is_correct } = answers.find((answer) => answer._id.toString() === id.toString());
		return includeCorrect ? { _id, value, is_correct } : { _id, value };
	}

	private async getExamDetails(examId: string) {
		const exam = await this.getById(examId);
		if (!exam) throw new Error("Kỳ thi không tồn tại");
		if (!exam.templates || exam.templates.length === 0) throw new Error("Không tìm thấy danh sách câu hỏi của kỳ thi.");

		const examDetail = await exam.populate({
			path: "templates.questions",
			select: "name type answers files",
		});
		if (!examDetail) throw new Error("Có lỗi xảy ra khi lấy chi tiết đề thi");

		return examDetail;
	}

	// Get random template from exam templates array
	private getRandomTemplate(templates: any[]): any {
		if (!templates || templates.length === 0) {
			throw new Error("Không có đề thi nào trong kỳ thi");
		}
		const randomIndex = Math.floor(Math.random() * templates.length);
		return templates[randomIndex];
	}

	// Get template by ID from templates array
	private getTemplateById(templates: any[], templateId: string): any {
		const template = templates.find((t: any) => t._id.toString() === templateId);
		if (!template) {
			throw new Error("Không tìm thấy đề thi");
		}
		return template;
	}

	async getTemplateQuestions(examId: string, templateId?: string) {
		const exam = await this.getExamDetails(examId);
		const templates = exam.templates;

		let template;
		if (templateId) {
			template = templates.find((t: any) => t._id.toString() === templateId);
			if (!template) throw new Error("Không tìm thấy đề thi");
		} else {
			template = this.getRandomTemplate(templates);
		}

		return template.questions;
	}

	async getTemplateDetails(examId: string) {
		const exam = await this.getExamDetails(examId);
		const templates = exam.templates;

		const formattedTemplates = templates.map((template: any) => ({
			template_id: template._id,
			template_name: template.name,
			quantity: template.questions.length,
			questions: template.questions.map((question: any) => ({
				...question.toObject(),
				answers: this.extractAnswerValues(question.answers),
			})),
		}));

		return {
			exam_name: exam.name,
			allowed_time: exam.allowed_time,
			template_count: templates.length,
			templates: formattedTemplates,
		};
	}

	private async formatQuestions(
		templateQuestions: any[],
		participantQuestions: IParticipantAnswer[],
		includeCorrect: boolean = false,
	): Promise<IFormattedQuestion[]> {
		const formattedQuestions: IFormattedQuestion[] = [];
		const templateQuestionMap = new Map<string, any>();

		templateQuestions.forEach((templateQuestion) => {
			templateQuestionMap.set(templateQuestion._id.toString(), templateQuestion);
		});

		for (const participantQuestion of participantQuestions) {
			const templateQuestion = templateQuestionMap.get(participantQuestion.question_id.toString());
			if (templateQuestion) {
				const answers = participantQuestion.question_answers
					.map((answerId) => this.getAnswerById(templateQuestion.answers, answerId, includeCorrect))
					.filter(Boolean);

				let files = [];
				if (templateQuestion.files && templateQuestion.files.length > 0) {
					files = (await questionBankProvider.getQuestionDetails(templateQuestion.id)).files;
				}

				formattedQuestions.push({
					_id: participantQuestion.question_id,
					name: templateQuestion.name,
					answers,
					files: files.length > 0 ? files : undefined,
				});
			}
		}

		return formattedQuestions;
	}

	private async formatParticipantQuestions(
		templateQuestions: any[],
		participantQuestions: any[],
		participantAnswers: any[],
		shuffledAnswers?: Record<string, any>,
	): Promise<IFormattedQuestion[]> {
		const formattedQuestions: IFormattedQuestion[] = [];
		const templateQuestionMap = new Map<string, any>();

		templateQuestions.forEach((templateQuestion) => {
			templateQuestionMap.set(templateQuestion._id.toString(), templateQuestion);
		});

		// Create answer map for quick lookup
		const answerMap = new Map<string, any>();
		if (participantAnswers) {
			participantAnswers.forEach((answer) => {
				answerMap.set(answer.question_id.toString(), answer);
			});
		}

		for (const questionId of participantQuestions) {
			const questionIdStr = questionId.toString();
			const templateQuestion = templateQuestionMap.get(questionIdStr);
			if (templateQuestion) {
				// Get shuffled answer order if exists
				const answerIds = shuffledAnswers?.[questionIdStr] || templateQuestion.answers.map((a: any) => a._id.toString());

				const answers = answerIds
					.map((answerId: string) => this.getAnswerById(templateQuestion.answers, answerId as unknown as ObjectId))
					.filter(Boolean);

				let files = [];
				if (templateQuestion.files && templateQuestion.files.length > 0) {
					files = (await questionBankProvider.getQuestionDetails(templateQuestion.id)).files;
				}

				// Get user answer if exists
				const userAnswer = answerMap.get(questionIdStr);

				formattedQuestions.push({
					_id: templateQuestion._id,
					name: templateQuestion.name,
					answers,
					files: files.length > 0 ? files : undefined,
					user_answer: userAnswer?.user_answer,
				});
			}
		}

		return formattedQuestions;
	}

	// Exam Statuses
	async getExamStatus(examId: string, userId: string) {
		let is_registered = false,
			is_submitted = false;

		const participant = await examParticipantProvider.getParticipantByExamAndUser(examId, userId);
		if (participant) is_registered = true;
		if (participant?.status === "submitted") is_submitted = true;

		return { is_registered, is_submitted };
	}

	// Exam Details
	async getExamDetailsForParticipant(examId: string, participantId: string) {
		const exam = await this.getExamDetails(examId);
		const { name, allowed_time, templates } = exam;

		// Get participant from exam_participants collection
		const participant = await examParticipantProvider.getParticipantByExamAndUser(examId, participantId);
		if (!participant) throw new Error("Bạn chưa đăng ký kỳ thi này");

		// Get template based on participant's questions (from exam_participant record) or random if not set
		let template;
		if (participant.questions && participant.questions.length > 0) {
			// Get template by finding which template contains the first question
			const firstQuestionId = participant.questions[0].toString();
			template = templates.find((t: any) =>
				t.questions.some((q: any) => q._id.toString() === firstQuestionId)
			);
		}
		if (!template) {
			template = this.getRandomTemplate(templates);
		}

		// Format questions based on participant's question order and shuffled answers
		const formattedQuestions = await this.formatParticipantQuestions(
			template.questions,
			participant.questions,
			participant.answers,
			participant.shuffled_answers
		);

		return {
			exam_name: name,
			allowed_time,
			template_name: template.name,
			quantity: formattedQuestions.length,
			questions: formattedQuestions,
		};
	}

	// Exam Result
	async getExamResultForParticipant(
		examId: string,
		participantId: string,
		includeQuestions: boolean = false,
	): Promise<IResult> {
		const exam = await this.getExamDetails(examId);
		const { name, allowed_time, templates, participants } = exam;

		const participant = participants.find((p) => p.user_id.toString() === participantId);

		// Get template based on participant's template_id or random if not set
		let template;
		if (participant.template_id) {
			template = this.getTemplateById(templates, participant.template_id.toString());
		} else {
			template = this.getRandomTemplate(templates);
		}

		const formattedQuestions = await this.formatQuestions(template.questions, participant.answers, true);
		const questionMap = new Map(formattedQuestions.map((q) => [q._id.toString(), q]));

		let correct_count = 0;
		const formattedAnswers = participant.answers.map((answer) => {
			const question = questionMap.get(answer.question_id.toString());
			if (!question) return;

			const is_correct = this.isAnswerCorrect(question, answer.user_answer) ?? false;
			if (is_correct) correct_count++;

			return {
				...question,
				user_answer: answer.user_answer,
				is_correct,
			};
		});

		if (includeQuestions) {
			formattedQuestions.forEach((question) => {
				const answer = formattedAnswers.find((ans) => ans?._id.toString() === question?._id.toString());
				if (answer) {
					question.user_answer = answer.user_answer;
					question.is_correct = answer.is_correct;
				} else {
					question.is_correct = false;
				}
			});
		}

		return {
			exam_name: name,
			allowed_time,
			template_name: template.name,
			quantity: template.questions.length,
			correct_count,
			time_taken: this.getTimeTaken(participant),
			questions: includeQuestions ? formattedQuestions : undefined,
		};
	}

	// Shuffle Questions And Answers - returns both answers and template_id
	async getShuffleQuestionsAndAnswers(examId: string, templateId?: string): Promise<{ answers: IParticipantAnswer[]; template_id: string }> {
		const exam = await this.getExamDetails(examId);
		const templates = exam.templates;

		let template;
		if (templateId) {
			template = this.getTemplateById(templates, templateId);
		} else {
			template = this.getRandomTemplate(templates);
		}

		const questions = template.questions;
		if (!questions.length) throw new Error("Không lấy được danh sách câu hỏi của đề thi");

		let participantAnswers = questions.map((question: any) => ({
			question_id: question._id,
			question_answers: question.answers.map((answer: any) => answer._id),
		}));

		participantAnswers = this.shuffleArray(participantAnswers);
		participantAnswers.forEach((answer: any) => {
			answer.question_answers = this.shuffleArray(answer.question_answers);
		});

		return {
			answers: participantAnswers,
			template_id: template._id.toString(),
		};
	}

	// Public shuffle method for external use
	shuffleArray<T>(array: T[]): T[] {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	// Statistics
	calculateTimeTakenInMinutes(startTime: Date, submitTime: Date): number {
		return (submitTime.getTime() - startTime.getTime()) / (1000 * 60);
	}

	private getTimeTaken(participant: IParticipant): number {
		return this.calculateTimeTakenInMinutes(participant.start_time, participant.submit_time);
	}

	private isAnswerCorrect(question: IQuestionBank | IFormattedQuestion, userAnswer: ObjectId): boolean {
		return question.answers.some((a) => a._id.toString() === userAnswer?.toString() && a.is_correct);
	}

	/**
	 * Get all submitted exam participants for an exam
	 */
	async getAllSubmittedParticipants(examId: string) {
		return await examParticipantProvider.getAll({
			where: {
				exam_id: new mongoose.Types.ObjectId(examId),
				status: "submitted",
			},
			pageSize: 10000,
			currentPage: 1,
		});
	}

	/**
	 * Aggregate participant statistics by user_id
	 * For each user, calculate: total_attempts, best_score, best_time_taken, best_submit_time
	 */
	private async aggregateParticipantStats(examId: string): Promise<Map<string, IParticipantStatistics>> {
		const participantsResult = await this.getAllSubmittedParticipants(examId);
		const participants = participantsResult.rows;

		const userStatsMap = new Map<string, any>();

		// Group attempts by user_id
		for (const participant of participants) {
			const userId = participant.user_id.toString();

			if (!userStatsMap.has(userId)) {
				userStatsMap.set(userId, {
					attempts: [],
				});
			}

			const userData = userStatsMap.get(userId);
			userData.attempts.push({
				attempt_number: participant.attempt_number,
				score: participant.score || 0,
				time_taken: participant.time_taken || 0,
				submit_time: participant.submit_time,
			});
		}

		// Calculate aggregated stats for each user
		const result = new Map<string, IParticipantStatistics>();

		for (const [userId, data] of userStatsMap.entries()) {
			const user = await userProvider.getById(userId);
			if (!user) continue;

			const attempts = data.attempts;
			const totalAttempts = attempts.length;

			// Find best attempt (highest score, if tie then shortest time)
			const bestAttempt = attempts.reduce((best: any, current: any) => {
				if (current.score > best.score) return current;
				if (current.score === best.score && current.time_taken < best.time_taken) return current;
				return best;
			}, attempts[0]);

			const profile = user.profile || {};

			result.set(userId, {
				_id: userId,
				first_name: user.first_name,
				middle_name: user.middle_name,
				last_name: user.last_name,
				identity_number: profile.identity_number,
				date_of_birth: profile.date_of_birth,
				gender: profile.gender,
				class_name: profile.class_name,
				school_name: profile.school_name,
				school_address: profile.school_address,
				phone: user.phone,
				classification: profile.classification,
				district: user.unit?.district,
				ward: user.unit?.ward,
				total_attempts: totalAttempts,
				best_score: bestAttempt.score,
				best_time_taken: bestAttempt.time_taken,
				best_submit_time: bestAttempt.submit_time,
			});
		}

		return result;
	}

	/**
	 * Calculate rank for each participant based on best_score (desc) and best_time_taken (asc)
	 */
	private calculateRanks(participantStats: IParticipantStatistics[]): IParticipantStatistics[] {
		// Sort by best_score desc, then by best_time_taken asc
		const sorted = [...participantStats].sort((a, b) => {
			if (b.best_score !== a.best_score) {
				return b.best_score - a.best_score; // Higher score first
			}
			return a.best_time_taken - b.best_time_taken; // Lower time first
		});

		// Assign ranks
		let currentRank = 1;
		let prevScore = -1;
		let prevTime = -1;

		return sorted.map((stat, index) => {
			// If same score and same time, same rank
			if (stat.best_score === prevScore && stat.best_time_taken === prevTime) {
				stat.rank = currentRank;
			} else {
				stat.rank = index + 1;
				currentRank = index + 1;
				prevScore = stat.best_score;
				prevTime = stat.best_time_taken;
			}
			return stat;
		});
	}

	/**
	 * Get aggregated statistics for a single participant by user_id
	 * Includes attempts array for detailed view
	 */
	async getSingleParticipantStatistics(examId: string, participantId: string): Promise<IParticipantStatistics & { attempts?: any[] } | null> {
		// Get all submitted participants for this exam
		const participantsResult = await this.getAllSubmittedParticipants(examId);
		const participants = participantsResult.rows;

		// Filter attempts for this specific user
		const userAttempts = participants
			.filter((p: any) => p.user_id.toString() === participantId)
			.map((p: any) => ({
				attempt_number: p.attempt_number,
				score: p.score || 0,
				time_taken: p.time_taken || 0,
				submit_time: p.submit_time,
			}));

		if (userAttempts.length === 0) return null;

		// Get user info
		const user = await userProvider.getById(participantId);
		if (!user) return null;

		// Calculate best attempt (highest score, if tie then shortest time)
		const bestAttempt = userAttempts.reduce((best: any, current: any) => {
			if (current.score > best.score) return current;
			if (current.score === best.score && current.time_taken < best.time_taken) return current;
			return best;
		}, userAttempts[0]);

		const profile = user.profile || {};

		return {
			_id: participantId,
			first_name: user.first_name,
			middle_name: user.middle_name,
			last_name: user.last_name,
			identity_number: profile.identity_number,
			date_of_birth: profile.date_of_birth,
			gender: profile.gender,
			class_name: profile.class_name,
			school_name: profile.school_name,
			school_address: profile.school_address,
			phone: user.phone,
			classification: profile.classification,
			district: user.unit?.district,
			ward: user.unit?.ward,
			total_attempts: userAttempts.length,
			best_score: bestAttempt.score,
			best_time_taken: bestAttempt.time_taken,
			best_submit_time: bestAttempt.submit_time,
			attempts: userAttempts,
		};
	}

	async getParticipantStatistics(examId: string, queryOptions: IQueryOptions): Promise<IPaginationResult> {
		const { where, pageSize, currentPage, sortBy } = queryOptions;

		const exam = await this.getById(examId);
		if (!exam) throw new Error("Kỳ thi không tồn tại");

		// Get aggregated participant stats from exam_participant collection
		const aggregatedStats = await this.aggregateParticipantStats(examId);
		let participantStats = Array.from(aggregatedStats.values());

		// Calculate ranks before filtering/pagination
		participantStats = this.calculateRanks(participantStats);

		// Apply filters, sorting, and pagination
		participantStats = applyFilters(participantStats, where);
		participantStats = applySorting(participantStats, sortBy);
		participantStats = applyPagination(participantStats, pageSize, currentPage);

		return generatePaginationResult(participantStats, pageSize, currentPage);
	}

	async getUnitStatistics(examId: string, queryOptions: IQueryOptions): Promise<IPaginationResult> {
		const { where, pageSize, currentPage, sortBy } = queryOptions;

		const exam = await this.getById(examId);
		if (!exam) throw new Error("Kỳ thi không tồn tại");

		// Get unit_schema from WebsiteConfig to determine group_by_field
		const websiteConfigProvider = new WebsiteConfigProvider();
		let config: any = null;
		try {
			// Retry a few times to allow MongoDB connection to establish
			for (let i = 0; i < 3; i++) {
				config = await websiteConfigProvider.getOne({ where: {} });
				if (config) break;
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		} catch (e) {
			// Fallback if WebsiteConfig is not available
			console.log("WebsiteConfig not available, using default group_by_field");
		}
		const unitSchema = config?.unit_schema || { group_by_field: "school_name" };
		const groupByField = unitSchema.group_by_field || "school_name";

		// Get aggregated participant stats from exam_participant collection
		const aggregatedStats = await this.aggregateParticipantStats(examId);
		let unitStats = this.generateUnitStatsFromAggregated(Array.from(aggregatedStats.values()), groupByField);

		// Calculate ranks before filtering/pagination
		unitStats = this.calculateUnitRanks(unitStats);

		unitStats = applyFilters(unitStats, where);
		unitStats = applySorting(unitStats, sortBy);
		unitStats = applyPagination(unitStats, pageSize, currentPage);

		return generatePaginationResult(unitStats, pageSize, currentPage);
	}

	/**
	 * Generate unit statistics from aggregated participant data
	 * @param participantStats - Array of participant statistics
	 * @param groupByField - Field to group by (e.g., 'school_name', 'district', 'ward')
	 */
	private generateUnitStatsFromAggregated(participantStats: IParticipantStatistics[], groupByField: string = "school_name"): IUnitStatistics[] {
		const unitStatsMap = new Map<string, IUnitStatistics>();

		for (const stat of participantStats) {
			// Get group value based on groupByField
			let groupValue: string;
			let unitAddress: string;

			if (groupByField === "school_name") {
				groupValue = stat.school_name || "Không xác định";
				unitAddress = stat.school_address || "";
			} else if (groupByField === "district") {
				groupValue = stat.district || "Không xác định";
				unitAddress = stat.ward || "";
			} else if (groupByField === "ward") {
				groupValue = stat.ward || "Không xác định";
				unitAddress = stat.district || "";
			} else if (groupByField === "class_name") {
				groupValue = stat.class_name || "Không xác định";
				unitAddress = stat.school_name || "";
			} else {
				// Default fallback
				groupValue = (stat as any)[groupByField] || "Không xác định";
				unitAddress = "";
			}

			const existing = unitStatsMap.get(groupValue) || {
				unit_name: groupValue,
				unit_address: unitAddress,
				district: stat.district,
				ward: stat.ward,
				participant_count: 0,
				correct_count: 0,
				time_taken: 0,
			};

			existing.participant_count += 1;
			existing.correct_count += stat.best_score;
			existing.time_taken += stat.best_time_taken;
			unitStatsMap.set(groupValue, existing);
		}

		// Calculate averages
		return Array.from(unitStatsMap.values()).map((stat) => ({
			...stat,
			avg_correct_count: stat.participant_count > 0 ? stat.correct_count / stat.participant_count : 0,
			avg_time_taken: stat.participant_count > 0 ? stat.time_taken / stat.participant_count : 0,
		}));
	}

	/**
	 * Calculate rank for each unit based on avg_correct_count (desc) and avg_time_taken (asc)
	 */
	private calculateUnitRanks(unitStats: IUnitStatistics[]): IUnitStatistics[] {
		// Sort by avg_correct_count desc, then by avg_time_taken asc
		const sorted = [...unitStats].sort((a: any, b: any) => {
			const aAvg = a.avg_correct_count || 0;
			const bAvg = b.avg_correct_count || 0;
			if (bAvg !== aAvg) {
				return bAvg - aAvg; // Higher avg score first
			}
			const aTime = a.avg_time_taken || 0;
			const bTime = b.avg_time_taken || 0;
			return aTime - bTime; // Lower avg time first
		});

		// Assign ranks
		let currentRank = 1;
		let prevAvg = -1;
		let prevTime = -1;

		return sorted.map((stat: any, index) => {
			const avgCorrect = stat.avg_correct_count || 0;
			const avgTime = stat.avg_time_taken || 0;

			// If same avg score and same avg time, same rank
			if (avgCorrect === prevAvg && avgTime === prevTime) {
				stat.rank = currentRank;
			} else {
				stat.rank = index + 1;
				currentRank = index + 1;
				prevAvg = avgCorrect;
				prevTime = avgTime;
			}
			return stat;
		});
	}

	/**
	 * Shuffle template questions - regenerate random questions for an existing template
	 * @param examId - Exam ID
	 * @param templateId - Template ID to shuffle
	 * @returns Object containing the number of multiple choice and essay questions in the new template
	 */
	async shuffleTemplateQuestions(examId: string, templateId: string): Promise<{ multiple_choice_count: number; essay_count: number; old_questions: string[]; new_questions: string[] }> {
		const exam = await this.getById(examId);
		if (!exam) throw new Error("Kỳ thi không tồn tại");

		// Find template index first
		const templateIndex = exam.templates.findIndex((t: any) => t._id.toString() === templateId);
		if (templateIndex === -1) throw new Error("Không tìm thấy đề thi");

		// Populate questions to count types
		const populatedExam = await exam.populate({
			path: "templates.questions",
			select: "type",
		});

		const populatedTemplate = populatedExam.templates[templateIndex];
		const currentQuestions = populatedTemplate.questions as any[];
		const oldQuestionIds = currentQuestions.map((q: any) => q._id?.toString() || q.toString());

		// Count current question types
		const multipleChoiceCount = currentQuestions.filter((q) => q.type === "MULTIPLE_CHOICE").length;
		const essayCount = currentQuestions.filter((q) => q.type === "ESSAY").length;

		// Get new random questions with same counts
		const newMultipleChoiceQuestions = await questionBankProvider.getRandomQuestionsByType(
			multipleChoiceCount,
			"MULTIPLE_CHOICE" as any,
		);
		const newEssayQuestions = essayCount > 0
			? await questionBankProvider.getRandomQuestionsByType(essayCount, "ESSAY" as any)
			: [];

		const newQuestionIds = [
			...newMultipleChoiceQuestions.map(q => q._id.toString()),
			...newEssayQuestions.map(q => q._id.toString()),
		];

		// Update template questions using index - assign ObjectIds directly
		exam.templates[templateIndex].questions = [
			...newMultipleChoiceQuestions.map(q => q._id),
			...newEssayQuestions.map(q => q._id),
		];

		// Mark templates as modified to ensure Mongoose saves the change
		exam.markModified('templates');

		// Save the exam
		await exam.save();

		return {
			multiple_choice_count: multipleChoiceCount,
			essay_count: essayCount,
			old_questions: oldQuestionIds,
			new_questions: newQuestionIds,
		};
	}
}
