import BaseProvider from "#templates/base/baseProvider";
import { IQuestionBank, IQuestionBankMethods, collectionName, schema } from "#models/questionBank";
import mongoose from "mongoose";

export class QuestionBankProvider extends BaseProvider<IQuestionBank, IQuestionBankMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	async getQuestions(maxQuantity: number) {
		const queryOptions = {
			pageSize: maxQuantity,
			currentPage: 1,
			sortField: "name",
			sortOrder: "asc",
			where: { $or: [{ is_deleted: false }, { is_deleted: undefined }] },
		};
		try {
			const questions = await this.getAll(queryOptions);
			return questions;
		} catch (error) {
			throw new Error("Lấy tất cả câu hỏi thất bại");
		}
	}

	async getQuestionsByType(maxQuantity: number, questionType: string) {
		const queryOptions = {
			pageSize: maxQuantity,
			currentPage: 1,
			sortField: "name",
			sortOrder: "asc",	
			where: {
				$and: [
					{ type: questionType },
					{ $or: [{ is_deleted: false }, { is_deleted: undefined }] },
				],
			},
		};
		try {
			const questions = await this.getAll(queryOptions);
			return questions;
		} catch (error) {
			throw new Error("Lấy câu hỏi theo loại thất bại");
		}
	}

	async getQuestionDetails(questionId: string) {
		const question = await this.getById(questionId, {
			attributes: [
				"name",
				"level",
				"priority",
				"files",
				"answers",
				"is_deleted",
				"created_by",
				"updated_by",
				"created_at",
				"updated_at",
			],
		});

		if (!question) throw new Error("Câu hỏi không tồn tại");
		if (!question.files) throw new Error("Không lấy được danh sách file của câu hỏi.");

		const questionDetail = await question.populate({
			path: "files",
			select: "file_name original_name mime_type file_type file_path size",
		});
		if (!questionDetail) throw new Error("Có lỗi xảy ra khi lấy chi tiết câu hỏi");

		return questionDetail;
	}

	async getQuestionsByIds(questionIds: string[]): Promise<IQuestionBank[]> {
		if (!questionIds || questionIds.length === 0) return [];

		const validIds = questionIds.filter((id) => id && id.match(/^[0-9a-fA-F]{24}$/));
		if (validIds.length === 0) return [];

		const objectIds = validIds.map((id) => new mongoose.Types.ObjectId(id));

		const result = await this.getAll({
			where: {
				_id: { $in: objectIds },
				$or: [{ is_deleted: false }, { is_deleted: undefined }],
			},
			pageSize: objectIds.length,
			currentPage: 1,
		});

		return result.rows;
	}

	async getRandomQuestionsByType(quantity: number, questionType: string): Promise<IQuestionBank[]> {
		const MAX_QUANTITY = 1000;
		try {
			if (quantity <= 0) return [];
			if (quantity > MAX_QUANTITY)
				throw new Error(`Hệ thống chỉ cho phép tạo đề thi có tối đa ${MAX_QUANTITY} câu.`);

			const result = await this.getQuestionsByType(MAX_QUANTITY, questionType);
			if (result.count === 0) throw new Error(`Không có câu hỏi ${questionType} nào trong ngân hàng câu hỏi`);
			if (result.count < quantity)
				throw new Error(`Số câu hỏi ${questionType} hợp lệ trong ngân hàng là: ${result.count}. Không đủ số câu cần tạo.`);

			const questions = result.rows;
			
			// Shuffle toàn bộ danh sách trước để đảm bảo random thực sự
			const shuffledAll = this.shuffleAndSlice(questions, questions.length);
			
			const groupedQuestions = this.groupQuestionsByLevel(shuffledAll);

			const numQuestionsPerLevel = Math.floor(quantity / 3);
			const easyQuestions = groupedQuestions["EASY"]?.slice(0, numQuestionsPerLevel) || [];
			const normalQuestions = groupedQuestions["NORMAL"]?.slice(0, numQuestionsPerLevel) || [];
			const hardQuestions = groupedQuestions["HARD"]?.slice(0, numQuestionsPerLevel) || [];

			let combinedQuestions = [...easyQuestions, ...normalQuestions, ...hardQuestions] as any[];
			if (combinedQuestions.length < quantity) {
				combinedQuestions = await this.fillRemainingQuestions(shuffledAll, combinedQuestions, quantity);
			}

			// Final shuffle to mix levels
			const finalShuffled = this.shuffleAndSlice(combinedQuestions, combinedQuestions.length);

			return finalShuffled;
		} catch (error) {
			throw new Error(`Lấy câu hỏi ngẫu nhiên theo loại thất bại: ${error.message}`);
		}
	}

	async getRandomQuestions(quantity: number): Promise<IQuestionBank[]> {
		const MAX_QUANTITY = 1000;
		try {
			if (quantity <= 0) throw new Error("Số lượng câu hỏi phải lớn hơn 0");
			if (quantity > MAX_QUANTITY)
				throw new Error(`Hệ thống chỉ cho phép tạo đề thi có tối đa ${MAX_QUANTITY} câu hỏi.`);

			const result = await this.getQuestions(MAX_QUANTITY);
			if (result.count === 0) throw new Error("Không có câu hỏi nào trong ngân hàng câu hỏi");
			if (result.count < quantity)
				throw new Error(`Số câu hỏi hợp lệ trong ngân hàng là: ${result.count}. Không đủ số câu cần tạo.`);

			const questions = result.rows;
			const groupedQuestions = this.groupQuestionsByLevel(questions);

			const numQuestionsPerLevel = Math.floor(quantity / 3);
			const easyQuestions = this.shuffleAndSlice(groupedQuestions["EASY"], numQuestionsPerLevel);
			const normalQuestions = this.shuffleAndSlice(groupedQuestions["NORMAL"], numQuestionsPerLevel);
			const hardQuestions = this.shuffleAndSlice(groupedQuestions["HARD"], numQuestionsPerLevel);

			let combinedQuestions = [...easyQuestions, ...normalQuestions, ...hardQuestions] as any[];
			if (combinedQuestions.length < quantity) {
				combinedQuestions = await this.fillRemainingQuestions(questions, combinedQuestions, quantity);
			}

			let sortedQuestions = combinedQuestions.sort((a, b) => a._id - b._id);
			sortedQuestions.forEach((q) => {
				q.answers.sort((a, b) => a - b);
			});

			// console.log("Quantity:", sortedQuestions.length);
			// console.log("Id - Level - Priority");
			// sortedQuestions.forEach((q) => {
			// 	console.log(`${q._id} - ${q.level} - ${q.priority}`);
			// 	// console.log("Answers:", q.answers);
			// });

			return sortedQuestions;
		} catch (error) {
			throw new Error(`Lấy câu hỏi ngẫu nhiên thất bại: ${error.message}`);
		}
	}

	private async fillRemainingQuestions(
		questions: IQuestionBank[],
		selectedQuestions: IQuestionBank[],
		quantity: number,
	): Promise<IQuestionBank[]> {
		const remainingQuestions = questions.filter((q) => !selectedQuestions.includes(q));
		const priorityGroups = this.groupQuestionsByPriority(remainingQuestions);
		for (let priority = 1; selectedQuestions.length < quantity; priority++) {
			const questionsAtPriority = priorityGroups[priority] || [];
			const shuffledQuestions = this.shuffleAndSlice(questionsAtPriority, quantity - selectedQuestions.length);
			selectedQuestions.push(...shuffledQuestions);
		}
		return selectedQuestions.slice(0, quantity);
	}

	private shuffleAndSlice(questions: IQuestionBank[], quantity: number): IQuestionBank[] {
		return questions.sort(() => 0.5 - Math.random()).slice(0, quantity);
	}

	private groupQuestionsByLevel(questions: IQuestionBank[]): Record<string, IQuestionBank[]> {
		return questions.reduce((groups, question) => {
			if (!groups[question.level]) {
				groups[question.level] = [];
			}
			groups[question.level].push(question);
			return groups;
		}, {} as Record<string, IQuestionBank[]>);
	}

	private groupQuestionsByPriority(questions: IQuestionBank[]): Record<number, IQuestionBank[]> {
		return questions.reduce((groups, question) => {
			if (!groups[question.priority]) {
				groups[question.priority] = [];
			}
			groups[question.priority].push(question);
			return groups;
		}, {} as Record<number, IQuestionBank[]>);
	}
}
