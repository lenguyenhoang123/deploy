import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { UserProvider } from "#providers/userProvider";
import { queryFilter, requiredFilters } from "#middlewares/query-filter";

export default (_express: Application) => {
	const provider = new UserProvider();
	return <Resource>{
		get: {
			middleware: [verify, queryFilter, requiredFilters(["currentPage", "pageSize"])],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/getUsers:
				 *   get:
				 *     tags: [User]
				 *     description: Retrieve a list of users with optional filtering, sorting, and pagination.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: filters
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Optional filter criteria for the users.
				 *       - name: pageSize
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           example: 10
				 *         description: Number of users per page.
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
				 *         description: Field to sort the users by.
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
						filters: req.payload.filters,
						pageSize: req.payload.pageSize,
						currentPage: req.payload.currentPage,
						sortField: req.payload.sortField,
						sortOrder: req.payload.sortOrder,
						attributes: req.payload.attributes,
					};

					return res.sendOk({
						data: await provider.getAll(queryOptions),
						message: "Lấy danh sách người dùng thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
