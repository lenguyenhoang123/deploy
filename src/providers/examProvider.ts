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
import { applyFilters, applyPagination, applySorting, generatePaginationResult } from "#services/statisticsService";
const userProvider = new UserProvider();

interface IFormattedQuestion {
	_id: ObjectId;
	name: string;
	answers: IAnswer[];
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
		if (!exam.template) throw new Error("Không tìm thấy danh sách câu hỏi của kỳ thi.");

		const examDetail = await exam.populate({
			path: "template.questions",
			select: "name answers",
		});
		if (!examDetail) throw new Error("Có lỗi xảy ra khi lấy chi tiết đề thi");

		return examDetail;
	}

	async getTemplateQuestions(examId: string) {
		const { template } = await this.getExamDetails(examId);
		return template.questions;
	}

	async getTemplateDetails(examId: string) {
		const { name, allowed_time, template } = await this.getExamDetails(examId);

		const questions = template.questions.map((question) => ({
			...question.toObject(),
			answers: this.extractAnswerValues(question.answers),
		}));

		return {
			exam_name: name,
			allowed_time,
			template_name: template.name,
			quantity: questions.length,
			questions,
		};
	}

	private async formatQuestions(
		templateQuestions: any[],
		participantQuestions: IParticipantAnswer[],
		includeCorrect: boolean = false,
	): Promise<IFormattedQuestion[]> {
		const formattedQuestions: IFormattedQuestion[] = [];
		const templateQuestionMap = new Map<string, any>();

		templateQuestions.forEach((t_question) => {
			templateQuestionMap.set(t_question._id.toString(), t_question);
		});

		for (const p_question of participantQuestions) {
			const t_question = templateQuestionMap.get(p_question.question_id.toString());
			if (t_question) {
				const answers = p_question.question_answers
					.map((answerId) => this.getAnswerById(t_question.answers, answerId, includeCorrect))
					.filter(Boolean);

				formattedQuestions.push({
					_id: p_question.question_id,
					name: t_question.name,
					answers,
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
		const { name, allowed_time, template, participants } = await this.getExamDetails(examId);

		const participant = participants.find((p) => p.user_id.toString() === participantId);
		if (!participant) throw new Error("Bạn chưa đăng ký kỳ thi này");

		const formattedQuestions = await this.formatQuestions(template.questions, participant.answers);

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
		const { name, allowed_time, template, participants } = await this.getExamDetails(examId);

		const participant = participants.find((p) => p.user_id.toString() === participantId);

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

	// Shuffle Questions And Answers
	async getShuffleQuestionsAndAnswers(examId: string): Promise<IParticipantAnswer[]> {
		const questions = await this.getTemplateQuestions(examId);
		if (!questions.length) throw new Error("Không lấy được danh sách câu hỏi của đề thi");

		let participantAnswers = questions.map((question) => ({
			question_id: question._id,
			question_answers: question.answers.map((answer) => answer._id),
		}));

		participantAnswers = this.shuffleArray(participantAnswers);
		participantAnswers.forEach((answer) => {
			answer.question_answers = this.shuffleArray(answer.question_answers);
		});

		return participantAnswers;
	}

	private shuffleArray<T>(array: T[]): T[] {
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
}
