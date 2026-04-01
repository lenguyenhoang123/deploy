import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ContentPageProvider } from "#providers/contentPageProvider";
import { queryFilter, requiredFilters } from "#middlewares/query-filter";
import { IContentPage, ContentPageType } from "#models/contentPage";
import { UserProvider } from "#providers/userProvider";
import slugify from "slugify";

type ContentPageCreate = Omit<IContentPage, "created_at" | "created_by" | "updated_at" | "updated_by">;

export default (_express: Application) => {
	const provider = new ContentPageProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		get: {
			middleware: [queryFilter, requiredFilters(["currentPage", "pageSize"])],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /content-page:
				 *   get:
				 *     tags: [Content Page]
				 *     description: Admin - list with pagination, or Public - get by slug query param.
				 *     parameters:
				 *       - name: slug
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Get single page by slug (public, no auth required if page is active)
				 *       - name: filters
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Filter by type, is_active (admin only)
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
				 *       - name: sortField
				 *         in: query
				 *         schema:
				 *           type: string
				 *       - name: sortOrder
				 *         in: query
				 *         schema:
				 *           type: string
				 *           enum: [asc, desc]
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					const slug = req.query.slug as string;

					// If slug provided, get single page (public access for active pages)
					if (slug) {
						const data = await provider.getBySlug(slug, { populateFiles: true });
						if (!data) throw new Error("Trang nội dung không tồn tại");
						if (!data.is_active && !req.user?.isAdmin) {
							throw new Error("Trang nội dung không tồn tại");
						}
						return res.sendOk({
							data,
							message: "Lấy thông tin trang nội dung thành công",
						});
					}

					// Otherwise, require admin for list
					if (!req.user?.isAdmin) {
						return res.sendErrorStatus({
							status: 401,
							message: "Yêu cầu đăng nhập",
							message_en: "Authentication required",
							err: new Error("No token provided"),
						});
					}

					await userProvider.validateUserId(req.user.id as string);

					const queryOptions = {
						where: req.payload.where,
						pageSize: req.payload.pageSize,
						currentPage: req.payload.currentPage,
						sortField: req.payload.sortField || "sort_order",
						sortOrder: req.payload.sortOrder || "asc",
						includes: [{ path: "files", select: "file_name original_name mime_type file_path size" }],
					};

					const data = await provider.getAll(queryOptions);

					return res.sendOk({
						data,
						message: "Lấy danh sách trang nội dung thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		post: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req<IContentPage, ContentPageCreate>, res: Res) => {
				/**
				 * @openapi
				 * /content-page:
				 *   post:
				 *     tags: [Content Page]
				 *     description: Create a new content page (admin only).
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             required: [title, type, content]
				 *             properties:
				 *               title:
				 *                 type: string
				 *                 minLength: 1
				 *                 maxLength: 255
				 *               slug:
				 *                 type: string
				 *                 description: URL-friendly identifier (optional, auto-generated from title if not provided)
				 *               type:
				 *                 type: string
				 *                 enum: [exam_rules, reference_docs, results, contact, announcement]
				 *               content:
				 *                 type: string
				 *                 description: HTML content
				 *               sort_order:
				 *                 type: number
				 *                 default: 0
				 *               is_active:
				 *                 type: boolean
				 *                 default: true
				 *               files:
				 *                 type: array
				 *                 items:
				 *                   type: string
				 *                 description: Array of file ObjectIds
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

					// Validate required fields (slug is optional, will auto-generate from title)
					const { title, type, content } = req.body;
					if (!title || !type || !content) {
						throw new Error("Vui lòng điền đầy đủ thông tin: title, type, content");
					}

					// Validate type
					if (!Object.values(ContentPageType).includes(type as ContentPageType)) {
						throw new Error(`Type không hợp lệ. Chọn một trong: ${Object.values(ContentPageType).join(", ")}`);
					}

					// Auto-generate slug from title if not provided
					const slugSource = req.body.slug || title;
					const finalSlug = slugify(slugSource, { lower: true, strict: true, locale: "vi" });

					// Check if slug already exists
					const existing = await provider.getBySlug(finalSlug);
					if (existing) {
						throw new Error("Slug đã tồn tại, vui lòng chọn slug khác");
					}

					const data = await provider.post({
						...req.body,
						slug: finalSlug,
						created_by: userId,
					});

					return res.sendOk({
						data,
						message: "Tạo trang nội dung thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
