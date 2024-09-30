import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { QuestionBankProvider } from "#providers/questionBankProvider";
import mongoose from "mongoose";
import { UserProvider } from "#providers/userProvider";
import { validateQuestionBankEntry } from "#middlewares/validator";
import { IQuestionBank } from "#models/questionBank";
import { FileProvider } from "#providers/fileProvider";

type QuestionBankCreate = Omit<IQuestionBank, "created_at" | "created_by" | "updated_at" | "updated_by">;

export default (_express: Application) => {
	const provider = new QuestionBankProvider();
	const userProvider = new UserProvider();
	const fileProvider = new FileProvider();
	return <Resource>{
		post: {
			middleware: [verify, verifyAdmin, validateQuestionBankEntry],
			handler: async (req: Req<IQuestionBank, QuestionBankCreate>, res: Res) => {
				/**
				 * @openapi
				 * /question-bank/{id}/copy:
				 *   post:
				 *     tags: [Question Bank]
				 *     description: Update a question by creating a new one from a copy and marking the original as deleted
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Question ID to copy
				 *         required: true
				 *     requestBody:
				 *       description: Create Question Bank Fields
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             $ref: '#/components/schemas/QuestionBankMutate'
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);

					const questionId = req.params.id as string;
					if (!questionId) throw new Error("ID câu hỏi không được để trống");
					if (!mongoose.Types.ObjectId.isValid(questionId)) throw new Error("ID câu hỏi không hợp lệ");

					const originalQuestion = await provider.getById(questionId, {
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
					if (!originalQuestion) throw new Error("Câu hỏi không tồn tại");
					if (originalQuestion.is_deleted) throw new Error("Câu hỏi đã bị xóa khỏi hệ thống");

					const updatedQuestion = req.body;
					if (areFieldsIdentical(updatedQuestion, originalQuestion)) {
						throw new Error("Không có thay đổi nào để cập nhật");
					}

					const files = updatedQuestion.files;
					if (files && files.length > 0) {
						await Promise.all(
							files.map(async (fileId) => {
								if (!mongoose.Types.ObjectId.isValid(fileId)) {
									throw new Error("Chứa file không hợp lệ");
								}

								const existingFile = await fileProvider.getById(fileId);
								if (!existingFile) {
									throw new Error("Chứa file không tồn tại trong hệ thống");
								}
							}),
						);
					}

					const [createdData, updateResult] = await Promise.all([
						provider.post({ ...req.body, created_by: userId, updated_by: userId }),
						originalQuestion.updateOne({ is_deleted: true, updated_by: userId }),
					]);
					if (updateResult.modifiedCount <= 0) throw new Error("Có lỗi xảy ra khi cập nhật câu hỏi");

					const data = {
						_id: createdData._id,
						name: createdData.name,
						level: createdData.level,
						priority: createdData.priority,
						files: createdData.files,
						answers: createdData.answers,
						is_deleted: createdData.is_deleted,
						created_by: createdData.created_by,
						updated_by: createdData.updated_by,
						created_at: createdData.created_at,
						updated_at: createdData.updated_at,
					};

					return res.sendOk({
						data: data,
						message: "Thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}

				function compareAnswerFields(answers1: any[], answers2: any[]): boolean {
					const normalizeAnswers = (answers: any[]) =>
						answers
							.map(({ value, is_correct }) => ({ value, is_correct }))
							.sort((a, b) => a.value.localeCompare(b.value));

					return JSON.stringify(normalizeAnswers(answers1)) === JSON.stringify(normalizeAnswers(answers2));
				}

				function areFieldsIdentical(obj1: any, obj2: any): boolean {
					return ["name", "level", "priority", "files", "answers"].every((field) => {
						if (field === "answers") {
							return compareAnswerFields(obj1[field], obj2[field]);
						}
						return JSON.stringify(obj1[field]) === JSON.stringify(obj2[field]);
					});
				}
			},
		},
	};
};
