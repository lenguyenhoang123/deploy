import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ContentPageProvider } from "#providers/contentPageProvider";
import { queryFilter } from "#middlewares/query-filter";

export default (_express: Application) => {
	const provider = new ContentPageProvider();

	return <Resource>{
		get: {
			middleware: [queryFilter],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /content-page/public:
				 *   get:
				 *     tags: [Content Page]
				 *     description: Get list of active content pages for public access (no pagination, sorted by sort_order).
				 *     parameters:
				 *       - name: filters
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Filter using query format (e.g., type==exam_rules,title@=quy,created_at[]=[2024-01-01&2024-12-31])
				 *       - name: currentPage
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           default: 1
				 *         description: Page number for pagination
				 *       - name: pageSize
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           default: 1000
				 *         description: Number of items per page
				 *       - name: sortField
				 *         in: query
				 *         schema:
				 *           type: string
				 *           enum: [title, slug, type, sort_order, created_at, updated_at]
				 *           default: sort_order
				 *         description: Field to sort by
				 *       - name: sortOrder
				 *         in: query
				 *         schema:
				 *           type: string
				 *           enum: [asc, desc]
				 *           default: asc
				 *         description: Sort order
				 *       - name: attributes
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Comma-separated list of fields to return
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					// Build base filter for active content
					const baseFilter = { is_active: true };
					
					// Combine with query filter from middleware
					const where = req.payload?.where 
						? { $and: [baseFilter, req.payload.where] }
						: baseFilter;

					const data = await provider.getAll({
						where,
						sortField: req.payload?.sortField || "sort_order",
						sortOrder: req.payload?.sortOrder || "asc",
						pageSize: req.payload?.pageSize || 1000,
						currentPage: req.payload?.currentPage || 1,
						includes: [{ path: "files", select: "file_name original_name mime_type file_path size" }],
					});

					return res.sendOk({
						data: data.rows,
						message: "Lấy danh sách trang nội dung thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
