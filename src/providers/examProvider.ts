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
		const { participants } = await this.getById(examId);
		let is_registered = false,
			is_submitted = false;

		const participant = participants.find((p) => p.user_id.toString() === userId);
		if (participant) is_registered = true;
		if (participant?.submit_time) is_submitted = true;

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

	async generateParticipantStatistics(examId: string, participantId: string): Promise<IParticipantStatistics> {
		const user = await userProvider.getById(participantId);
		const { correct_count, time_taken } = await this.getExamResultForParticipant(examId, participantId);
		return {
			_id: user?.id,
			first_name: user?.first_name,
			middle_name: user?.middle_name,
			last_name: user?.last_name,
			district: user?.unit?.district,
			ward: user?.unit?.ward,
			correct_count,
			time_taken,
		};
	}

	async getParticipantStatistics(examId: string, queryOptions: IQueryOptions): Promise<IPaginationResult> {
		const { where, pageSize, currentPage, sortBy } = queryOptions;

		const exam = await this.getById(examId);
		if (!exam) throw new Error("Kỳ thi không tồn tại");

		const validParticipants = this.filterValidParticipants(exam.participants);

		let participantStats = await this.generateParticipantStats(examId, validParticipants);

		participantStats = applyFilters(participantStats, where);
		participantStats = applySorting(participantStats, sortBy);
		participantStats = applyPagination(participantStats, pageSize, currentPage);

		return generatePaginationResult(participantStats, pageSize, currentPage);
	}

	async getUnitStatistics(examId: string, queryOptions: IQueryOptions): Promise<IPaginationResult> {
		const { where, pageSize, currentPage, sortBy } = queryOptions;

		const exam = await this.getById(examId);
		if (!exam) throw new Error("Kỳ thi không tồn tại");

		const validParticipants = this.filterValidParticipants(exam.participants);

		let districtStats = await this.generateDistrictStats(examId, validParticipants);

		districtStats = applyFilters(districtStats, where);
		districtStats = applySorting(districtStats, sortBy);
		districtStats = applyPagination(districtStats, pageSize, currentPage);

		return generatePaginationResult(districtStats, pageSize, currentPage);
	}

	private filterValidParticipants(participants: IParticipant[]): IParticipant[] {
		return participants.filter((p) => p.start_time && p.submit_time);
	}

	private async generateParticipantStats(
		examId: string,
		participants: IParticipant[],
	): Promise<IParticipantStatistics[]> {
		const stats = await Promise.all(
			participants.map(async (participant) =>
				this.generateParticipantStatistics(examId, participant.user_id.toString()),
			),
		);
		return stats.filter(Boolean);
	}

	private async generateDistrictStats(examId: string, participants: IParticipant[]): Promise<IUnitStatistics[]> {
		const districtStatsMap = new Map<string, IUnitStatistics>();

		for (const participant of participants) {
			const user = await userProvider.getById(participant.user_id.toString());
			const { district } = user.unit;
			const { correct_count, time_taken } = await this.getExamResultForParticipant(
				examId,
				participant.user_id.toString(),
			);

			const stats = districtStatsMap.get(district) || {
				district,
				correct_count: 0,
				time_taken: 0,
				participant_count: 0,
			};
			stats.correct_count += correct_count;
			stats.time_taken += time_taken;
			stats.participant_count += 1;
			districtStatsMap.set(district, stats);
		}

		return Array.from(districtStatsMap.values());
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
