import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { QuestionBankProvider } from "#providers/questionBankProvider";
import { queryFilter, requiredFilters } from "#middlewares/query-filter";
import { IQuestionBank } from "#models/questionBank";
import { validateQuestionBankEntry } from "#middlewares/validator";
import { UserProvider } from "#providers/userProvider";
import { FileProvider } from "#providers/fileProvider";
import mongoose from "mongoose";

type QuestionBankCreate = Omit<IQuestionBank, "created_at" | "created_by" | "updated_at" | "updated_by">;

export default (_express: Application) => {
	const provider = new QuestionBankProvider();
	const userProvider = new UserProvider();
	const fileProvider = new FileProvider();
	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin, queryFilter, requiredFilters(["currentPage", "pageSize"])],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /question-bank:
				 *   get:
				 *     tags: [Question Bank]
				 *     description: Retrieve a list of questions with optional filtering, sorting, and pagination.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: filters
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Optional filter criteria for the questions.
				 *       - name: pageSize
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           example: 10
				 *         description: Number of questions per page.
				 *       - name: currentPage
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           example: 1
				 *         description: Current page number for pagination.
				 *       - name: sortField
				 *         in: query
				 *         schema:
				 *           type: string
				 *           example: name
				 *         description: Field to sort the questions by.
				 *       - name: sortOrder
				 *         in: query
				 *         schema:
				 *           type: string
				 *           enum: [asc, desc]
				 *           example: asc
				 *         description: Sort order, either ascending (asc) or descending (desc).
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					await userProvider.validateUserId(req.user.id as string);
					const queryOptions = {
						where: req.payload.where,
						pageSize: req.payload.pageSize,
						currentPage: req.payload.currentPage,
						sortField: req.payload.sortField,
						sortOrder: req.payload.sortOrder,
						attributes: [
							"name",
							"type",
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
					};
					return res.sendOk({
						data: await provider.getAll(queryOptions),
						message: "Lấy danh sách câu hỏi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		post: {
			middleware: [verify, verifyAdmin, validateQuestionBankEntry],
			handler: async (req: Req<IQuestionBank, QuestionBankCreate>, res: Res) => {
				/**
				 * @openapi
				 * /question-bank:
				 *   post:
				 *     tags: [Question Bank]
				 *     description: Create a new question bank
				 *     security:
				 *       - Bearer: []
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

					const files = req.body.files;
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

					return res.sendOk({
						data: await provider.post({ ...req.body, created_by: userId }),
						message: "Thêm câu hỏi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
