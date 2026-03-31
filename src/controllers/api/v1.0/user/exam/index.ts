import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { queryFilter, requiredFilters } from "#middlewares/query-filter";
import { UserProvider } from "#providers/userProvider";

export default (_express: Application) => {
	const provider = new ExamProvider();
	const userProvider = new UserProvider();
	return <Resource>{
		get: {
			middleware: [verify, queryFilter, requiredFilters(["currentPage", "pageSize"])],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/exam:
				 *   get:
				 *     tags: [User]
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
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
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
							"templates",
							"created_by",
							"updated_by",
							"created_at",
							"updated_at",
						],
					};

					let data = await provider.getAll(queryOptions);

					const exams = await Promise.all(
						data.rows.map(async (exam) => {
							const { is_registered, is_submitted } = await provider.getExamStatus(exam.id, userId);
							return {
								_id: exam._id,
								name: exam.name,
								description: exam.description,
								start_time: exam.start_time,
								end_time: exam.end_time,
								allowed_time: exam.allowed_time,
								created_by: exam.created_by,
								updated_by: exam.updated_by,
								created_at: exam.created_at,
								updated_at: exam.updated_at,
								templates: exam?.templates?.map((t: any) => ({
									name: t?.name,
									question_count: t?.questions?.length || 0,
								})),
								is_registered: is_registered || false,
								is_submitted: is_submitted || false,
							};
						}),
					);

					const responsesData = {
						...data,
						rows: exams,
					};

					return res.sendOk({
						data: responsesData,
						message: "Lấy danh sách kỳ thi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
