import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { CertificateProvider } from "#providers/certificateProvider";
import { queryFilter, requiredFilters } from "#middlewares/query-filter";

export default (_express: Application) => {
	const provider = new CertificateProvider();

	return <Resource>{
		get: {
			middleware: [verify, queryFilter, requiredFilters(["currentPage", "pageSize"])],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/certificates:
				 *   get:
				 *     tags: [Certificate]
				 *     description: Get current user's certificates with pagination
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: filters
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Optional filter criteria for the certificates.
				 *       - name: pageSize
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           example: 10
				 *         description: Number of certificates per page.
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
				 *           example: created_at
				 *         description: Field to sort the certificates by.
				 *       - name: sortOrder
				 *         in: query
				 *         schema:
				 *           type: string
				 *           enum: [asc, desc]
				 *           example: desc
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
					const userId = req.user.id as string;
					const { pageSize, currentPage, sortField, sortOrder } = req.payload;

					// Build where clause - merge filters with user_id
					const where = {
						...(req.payload.where || {}),
						user_id: userId,
					};

					const result = await provider.getAll({
						where,
						pageSize,
						currentPage,
						sortField: sortField || "created_at",
						sortOrder: sortOrder || "desc",
					});

					return res.sendOk({ data: result });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
