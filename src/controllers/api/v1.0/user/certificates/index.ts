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
				 *       - name: pageSize
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           example: 10
				 *       - name: currentPage
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           example: 1
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
					const { pageSize, currentPage } = req.payload;

					const result = await provider.getAll({
						where: { user_id: userId },
						pageSize,
						currentPage,
						sortField: "created_at",
						sortOrder: "desc",
					});

					return res.sendOk({ data: result });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
