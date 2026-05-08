import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { CertificateTemplateProvider } from "#providers/certificateTemplateProvider";
import { UserProvider } from "#providers/userProvider";
import { ICertificateTemplate } from "#models/certificateTemplate";

type TemplateCreate = Omit<ICertificateTemplate, "created_at" | "created_by" | "updated_at" | "updated_by">;

export default (_express: Application) => {
	const provider = new CertificateTemplateProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/content/{id}/certificate-template:
				 *   get:
				 *     tags: [Learning Certificate]
				 *     description: Get certificate template for learning content (admin only)
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         required: true
				 *         schema:
				 *           type: string
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const contentId = req.params.id;
					const template = await provider.getByContentId(contentId);

					if (!template) {
						return res.sendOk({
							data: null,
							message: "Chưa có cấu hình chứng chỉ cho nội dung này",
						});
					}

					return res.sendOk({ data: template });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		put: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req<ICertificateTemplate, TemplateCreate>, res: Res) => {
				/**
				 * @openapi
				 * /learning/content/{id}/certificate-template:
				 *   put:
				 *     tags: [Learning Certificate]
				 *     description: Update or create certificate template for learning content (admin only)
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         required: true
				 *         schema:
				 *           type: string
				 *     requestBody:
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             required: [name, is_enabled, conditions, design]
				 *             properties:
				 *               name:
				 *                 type: string
				 *                 example: "Chung nhan hoan thanh bai on tap"
				 *               is_enabled:
				 *                 type: boolean
				 *                 example: true
				 *               conditions:
				 *                 type: object
				 *                 required: [min_score]
				 *                 properties:
				 *                   min_score:
				 *                     type: number
				 *                     minimum: 0
				 *                     maximum: 100
				 *                     example: 80
				 *                   require_all_correct:
				 *                     type: boolean
				 *                     example: false
				 *                   completion_required:
				 *                     type: boolean
				 *                     example: true
				 *               design:
				 *                 type: object
				 *                 required: [title, layout, content, signatures]
				 *                 properties:
				 *                   title:
				 *                     type: string
				 *                     example: "CHUNG NHAN HOAN THANH"
				 *                   subtitle:
				 *                     type: string
				 *                     example: "Bai on tap trac nghiem"
				 *                   layout:
				 *                     type: object
				 *                     properties:
				 *                       font_family:
				 *                         type: string
				 *                         example: "Arial"
				 *                       primary_color:
				 *                         type: string
				 *                         example: "#1a73e8"
				 *                       secondary_color:
				 *                         type: string
				 *                         example: "#34a853"
				 *                   content:
				 *                     type: object
				 *                     properties:
				 *                       show_score:
				 *                         type: boolean
				 *                         example: true
				 *                       show_rank:
				 *                         type: boolean
				 *                         example: false
				 *                       show_completion_date:
				 *                         type: boolean
				 *                         example: true
				 *                       show_exam_name:
				 *                         type: boolean
				 *                         example: true
				 *                   signatures:
				 *                     type: array
				 *                     items:
				 *                       type: object
				 *                       properties:
				 *                         name:
				 *                           type: string
				 *                           example: "Nguyen Van A"
				 *                         title:
				 *                           type: string
				 *                           example: "Giam doc"
				 *                         position:
				 *                           type: string
				 *                           enum: [left, center, right]
				 *                           example: center
				 *                         signature_image:
				 *                           type: string
				 *                           description: "File ID của ảnh chữ ký"
				 *                           example: "69fab939159c64d0bc76a979"
				 *               legal_text:
				 *                 type: string
				 *                 example: "Van ban phap ly..."
				 *           example:
				 *             name: "Chung nhan hoan thanh bai on tap"
				 *             is_enabled: true
				 *             conditions:
				 *               min_score: 80
				 *               require_all_correct: false
				 *               completion_required: true
				 *             design:
				 *               title: "CHUNG NHAN HOAN THANH"
				 *               subtitle: "Bai on tap trac nghiem"
				 *               layout:
				 *                 font_family: "Arial"
				 *                 primary_color: "#1a73e8"
				 *                 secondary_color: "#34a853"
				 *               content:
				 *                 show_score: true
				 *                 show_rank: false
				 *                 show_completion_date: true
				 *                 show_exam_name: true
				 *               signatures:
				 *                 - name: "Nguyen Van A"
				 *                   title: "Giam doc"
				 *                   position: "center"
				 *                   signature_image: "69fab939159c64d0bc76a979"
				 *             legal_text: "Van ban phap ly"
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const contentId = req.params.id;

					const template = await provider.updateOrCreateForContent(
						contentId,
						req.body,
						userId
					);

					return res.sendOk({
						data: template,
						message: "Cập nhật cấu hình chứng chỉ thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
