import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ContentPageProvider } from "#providers/contentPageProvider";

export default (_express: Application) => {
	const provider = new ContentPageProvider();

	return <Resource>{
		get: {
			middleware: [],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /content-page/public:
				 *   get:
				 *     tags: [Content Page]
				 *     description: Get list of active content pages for public access (no pagination, sorted by sort_order).
				 *     parameters:
				 *       - name: type
				 *         in: query
				 *         schema:
				 *           type: string
				 *           enum: [exam_rules, reference_docs, results, contact, announcement]
				 *         description: Filter by page type
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					const type = req.query.type as string;

					const where: any = { is_active: true };
					if (type) {
						where.type = type;
					}

					const data = await provider.getAll({
						where,
						sortField: "sort_order",
						sortOrder: "asc",
						pageSize: 1000,
						currentPage: 1,
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
