import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ContentPageProvider } from "#providers/contentPageProvider";
import { IContentPage, ContentPageType } from "#models/contentPage";
import { UserProvider } from "#providers/userProvider";
import mongoose from "mongoose";
import slugify from "slugify";

type ContentPageUpdate = Partial< Omit<IContentPage, "created_at" | "created_by" | "updated_at" | "updated_by">>;

export default (_express: Application) => {
	const provider = new ContentPageProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /content-page/{id}:
				 *   get:
				 *     tags: [Content Page]
				 *     description: Get content page by ID (admin only).
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *         required: true
				 *     responses:
				 *       200:
				 *         description: Success
				 */

				try {
					const id = req.params.id as string;
					if (!id) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("ID không hợp lệ");

					await userProvider.validateUserId(req.user.id as string);

					const data = await provider.getById(id, {
						includes: [{ path: "files", select: "file_name original_name mime_type file_path size" }],
					});

					if (!data) throw new Error("Trang nội dung không tồn tại");

					return res.sendOk({
						data,
						message: "Lấy thông tin trang nội dung thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		put: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req<IContentPage, ContentPageUpdate>, res: Res) => {
				/**
				 * @openapi
				 * /content-page/{id}:
				 *   put:
				 *     tags: [Content Page]
				 *     description: Update content page by ID (admin only).
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *         required: true
				 *     requestBody:
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             properties:
				 *               title:
				 *                 type: string
				 *                 minLength: 1
				 *                 maxLength: 255
				 *               slug:
				 *                 type: string
				 *               type:
				 *                 type: string
				 *                 enum: [exam_rules, reference_docs, results, contact, announcement]
				 *               content:
				 *                 type: string
				 *               sort_order:
				 *                 type: number
				 *               is_active:
				 *                 type: boolean
				 *               files:
				 *                 type: array
				 *                 items:
				 *                   type: string
				 *     responses:
				 *       200:
				 *         description: Success
				 */

				try {
					const id = req.params.id as string;
					if (!id) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("ID không hợp lệ");

					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);

					const existing = await provider.getById(id);
					if (!existing) throw new Error("Trang nội dung không tồn tại");

					const updateData: Partial<IContentPage> = { ...req.body, updated_by: userId };

					// Validate type if provided
					if (updateData.type && !Object.values(ContentPageType).includes(updateData.type as ContentPageType)) {
						throw new Error(`Type không hợp lệ. Chọn một trong: ${Object.values(ContentPageType).join(", ")}`);
					}

					// Handle slug update - auto-generate from title if not provided
					if (updateData.slug) {
						const finalSlug = slugify(updateData.slug, { lower: true, strict: true, locale: "vi" });
						// Check if new slug conflicts with another page
						const existingWithSlug = await provider.getBySlug(finalSlug);
						if (existingWithSlug && existingWithSlug._id.toString() !== id) {
							throw new Error("Slug đã tồn tại, vui lòng chọn slug khác");
						}
						updateData.slug = finalSlug;
					} else if (updateData.title) {
						// Auto-generate slug from new title
						const finalSlug = slugify(updateData.title, { lower: true, strict: true, locale: "vi" });
						// Only update if slug is different and not taken by another page
						if (finalSlug !== existing.slug) {
							const existingWithSlug = await provider.getBySlug(finalSlug);
							if (existingWithSlug && existingWithSlug._id.toString() !== id) {
								throw new Error("Slug tự động tạo đã tồn tại, vui lòng nhập slug thủ công");
							}
							updateData.slug = finalSlug;
						}
					}

					await provider.put(id, updateData);

					return res.sendOk({
						data: { message: "Cập nhật trang nội dung thành công" },
						message: "Cập nhật trang nội dung thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		delete: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /content-page/{id}:
				 *   delete:
				 *     tags: [Content Page]
				 *     description: Delete content page by ID (admin only).
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *         required: true
				 *     responses:
				 *       200:
				 *         description: Success
				 */

				try {
					const id = req.params.id as string;
					if (!id) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("ID không hợp lệ");

					await userProvider.validateUserId(req.user.id as string);

					const existing = await provider.getById(id);
					if (!existing) throw new Error("Trang nội dung không tồn tại");

					await provider.delete(id);

					return res.sendOk({
						data: { message: "Xóa trang nội dung thành công" },
						message: "Xóa trang nội dung thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
