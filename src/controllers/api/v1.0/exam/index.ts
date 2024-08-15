import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { queryFilter, requiredFilters } from "#middlewares/query-filter";
import { IExam } from "#models/exam";
import { validateExamEntry } from "#middlewares/validator";
import { UserProvider } from "#providers/userProvider";

type ExamCreate = Omit<IExam, "created_at" | "created_by" | "updated_at" | "updated_by">;

export default (_express: Application) => {
	const provider = new ExamProvider();
	const userProvider = new UserProvider();
	return <Resource>{
		get: {
			middleware: [verify, queryFilter, requiredFilters(["currentPage", "pageSize"])],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam:
				 *   get:
				 *     tags: [Exam]
				 *     description: Retrieve a list of exams with optional filtering, sorting, and pagination.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: filters
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Optional filter criteria for the exams.
				 *       - name: pageSize
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           example: 10
				 *         description: Number of exams per page.
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
				 *         description: Field to sort the exams by.
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
					const queryOptions = {
						where: req.payload.where,
						pageSize: req.payload.pageSize,
						currentPage: req.payload.currentPage,
						sortField: req.payload.sortField,
						sortOrder: req.payload.sortOrder,
						attributes: [
							"name",
							"description",
							"start_time",
							"end_time",
							"allowed_time",
							"template",
							"participants",
							"created_by",
							"updated_by",
							"created_at",
							"updated_at",
						],
					};

					return res.sendOk({
						data: await provider.getAll(queryOptions),
						message: "Lấy danh sách kỳ thi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		post: {
			middleware: [verify, verifyAdmin, validateExamEntry],
			handler: async (req: Req<IExam, ExamCreate>, res: Res) => {
				/**
				 * @openapi
				 * /exam:
				 *   post:
				 *     tags: [Exam]
				 *     description: Create a new exam
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *       description: Create Exam Fields
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             $ref: '#/components/schemas/ExamMutate'
				 *           example:
				 *             {
				 *               "name": "Kỳ thi tháng 08/2024",
				 *               "description": "Kỳ thi đánh giá kiến thức cơ bản tháng 08/2024",
				 *               "start_time": "2024-08-01T09:00:00Z",
				 *               "end_time": "2024-08-31T09:00:00Z",
				 *               "allowed_time": 120,
				 *             }
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					const userId = await userProvider.getUserIdFromRequest(req);
					return res.sendOk({
						data: await provider.post({ ...req.body, created_by: userId }),
						message: "Tạo kỳ thi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
