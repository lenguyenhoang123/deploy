import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { UserProvider } from "#providers/userProvider";
import { FileProvider } from "#providers/fileProvider";
import { queryFilter, requiredFilters } from "#middlewares/query-filter";

export default (_express: Application) => {
	const provider = new FileProvider();
	const userProvider = new UserProvider();
	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin, queryFilter, requiredFilters(["currentPage", "pageSize"])],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /debug/file:
				 *   get:
				 *     tags: [Debug]
				 *     description: Retrieve a list of files with optional filtering, sorting, and pagination.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: filters
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Optional filter criteria for the files.
				 *       - name: pageSize
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           example: 10
				 *         description: Number of files per page.
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
				 *         description: Field to sort the files by.
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
							"file_name",
							"original_name",
							"mime_type",
							"file_type",
							"file_path",
							"size",
							"created_by",
							"updated_by",
							"created_at",
							"updated_at",
						],
					};
					return res.sendOk({
						data: await provider.getAll(queryOptions),
						message: "Lấy danh sách file thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
