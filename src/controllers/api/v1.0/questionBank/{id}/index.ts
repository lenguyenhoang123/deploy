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
		get: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /questionBank/{id}:
				 *   get:
				 *     tags: [Question Bank]
				 *     description: Get question bank by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: ID
				 *         required: true
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					const questionId = req.params.id as string;
					if (!questionId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(questionId)) throw new Error("ID không hợp lệ");

					await userProvider.validateUserId(req.user.id as string);
					const data = await provider.getQuestionDetails(questionId);

					return res.sendOk({
						data: data,
						message: "Lấy câu hỏi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		put: {
			middleware: [verify, verifyAdmin, validateQuestionBankEntry],
			handler: async (req: Req<IQuestionBank, QuestionBankCreate>, res: Res) => {
				/**
				 * @openapi
				 * /questionBank/{id}:
				 *   put:
				 *     tags: [Question Bank]
				 *     description: Update a question.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: ID
				 *         required: true
				 *     requestBody:
				 *       description: Update Question Bank Fields
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
					const questionId = req.params.id as string;
					if (!questionId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(questionId)) throw new Error("ID không hợp lệ");

					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const question = await provider.getById(questionId, {
						attributes: [
							"name",
							"level",
							"priority",
							"files",
							"answers",
							"created_by",
							"updated_by",
							"created_at",
							"updated_at",
						],
					});
					if (!question) throw new Error("Câu hỏi không tồn tại");

					const updatedQuestion = req.body;

					const files = updatedQuestion.files;
					if (files && files.length > 0) {
						await Promise.all(
							files.map(async (fileId) => {
								if (!mongoose.Types.ObjectId.isValid(fileId)) {
									throw new Error("Câu hỏi chứa file không hợp lệ");
								}

								const existingFile = await fileProvider.getById(fileId);
								if (!existingFile) {
									throw new Error("Câu hỏi chứa file không tồn tại");
								}
							}),
						);
					}

					const data = await question.updateOne({
						name: updatedQuestion.name,
						level: updatedQuestion.level,
						priority: updatedQuestion.priority,
						files: updatedQuestion.files,
						answers: updatedQuestion.answers,
						updated_by: userId,
					});

					if (data.modifiedCount <= 0) throw new Error("Có lỗi xảy ra khi cập nhật câu hỏi");
					return res.sendOk({ data: { message: "Cập nhật câu hỏi thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		delete: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /questionBank/{id}:
				 *   delete:
				 *     tags: [Question Bank]
				 *     description: Delete question bank by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: ID to delete
				 *         required: true
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					const deleteId = req.params.id as string;
					if (!deleteId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(deleteId)) throw new Error("ID không hợp lệ");

					await userProvider.validateUserId(req.user.id as string);
					const existingItem = await provider.getById(deleteId);
					if (!existingItem) throw new Error("Câu hỏi không tồn tại");

					return res.sendOk({
						data: await provider.delete(deleteId),
						message: "Xóa câu hỏi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
