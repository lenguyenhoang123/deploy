import BaseProvider from "#templates/base/baseProvider";
import { IExam, IExamMethods, collectionName, schema, IParticipantAnswer } from "#models/exam";
import { IAnswer, IQuestionBank } from "#models/questionBank";
import { ObjectId } from "mongoose";

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

		const examDetail = await exam.populate({ path: "template.questions", select: "name answers" });
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

	async getExamResultForParticipant(examId: string, participantId: string) {
		const { name, allowed_time, template, participants } = await this.getExamDetails(examId);

		const participant = participants.find((p) => p.user_id.toString() === participantId);
		if (!participant) throw new Error("Bạn chưa đăng ký kỳ thi này");

		const formattedQuestions = await this.formatQuestions(template.questions, participant.answers, true);
		const questionMap = new Map(formattedQuestions.map((q) => [q._id.toString(), q]));

		const formattedAnswers = participant.answers.map((answer) => {
			const question = questionMap.get(answer.question_id.toString());
			if (!question) throw new Error(`Không tìm thấy câu hỏi với ID: ${answer.question_id}`);

			const is_correct = this.isAnswerCorrect(question, answer.user_answer) ?? false;

			return {
				...question,
				user_answer: answer.user_answer,
				is_correct,
			};
		});

		formattedQuestions.forEach((question) => {
			const answer = formattedAnswers.find((ans) => ans._id.toString() === question._id.toString());
			if (answer) {
				question.user_answer = answer.user_answer;
				question.is_correct = answer.is_correct;
			} else {
				question.is_correct = false;
			}
		});

		return {
			exam_name: name,
			allowed_time,
			template_name: template.name,
			quantity: formattedQuestions.length,
			questions: formattedQuestions,
		};
	}

	private isAnswerCorrect(question: IQuestionBank | IFormattedQuestion, userAnswer: ObjectId): boolean {
		return question.answers.some((a) => a._id.toString() === userAnswer?.toString() && a.is_correct);
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

	async updateParticipantAnswersWithSubmittedAnswers(
		originalAnswers: IParticipantAnswer[],
		newSubmittedAnswers: IParticipantAnswer[],
	): Promise<IParticipantAnswer[]> {
		const answerMap = new Map(
			newSubmittedAnswers.map(({ question_id, user_answer }) => [question_id.toString(), user_answer]),
		);
		return originalAnswers.map((answer) => ({
			...answer,
			user_answer: answerMap.get(answer.question_id.toString()) || answer.user_answer,
		}));
	}
}
