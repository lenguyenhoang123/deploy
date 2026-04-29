import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { CertificateTemplateProvider } from "#providers/certificateTemplateProvider";
import { ICertificateTemplate } from "#models/certificateTemplate";

type TemplateCreate = Omit<ICertificateTemplate, "created_at" | "created_by" | "updated_at" | "updated_by">;

export default (_express: Application) => {
	const provider = new CertificateTemplateProvider();

	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/{exam_id}/certificate-template:
				 *   get:
				 *     tags: [Certificate]
				 *     description: Get certificate template for an exam (admin only)
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: exam_id
				 *         in: path
				 *         required: true
				 *         schema:
				 *           type: string
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */
				try {
					const examId = req.params.exam_id;
					const template = await provider.getByExamId(examId);

					if (!template) {
						return res.sendOk({
							data: null,
							message: "Chưa có cấu hình chứng chỉ cho kỳ thi này",
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
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/{exam_id}/certificate-template:
				 *   put:
				 *     tags: [Certificate]
				 *     description: Update or create certificate template for an exam (admin only)
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: exam_id
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
				 *             properties:
				 *               name:
				 *                 type: string
				 *               is_enabled:
				 *                 type: boolean
				 *               conditions:
				 *                 type: object
				 *                 properties:
				 *                   min_score:
				 *                     type: number
				 *                   require_all_correct:
				 *                     type: boolean
				 *                   completion_required:
				 *                     type: boolean
				 *               design:
				 *                 type: object
				 *               legal_text:
				 *                 type: string
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */
				try {
					const examId = req.params.exam_id;
					const data: TemplateCreate = {
						exam_id: examId,
						...req.body,
					};

					const template = await provider.updateOrCreate(examId, data, req.user.id as string);
					return res.sendOk({
						data: template,
						message: "Cập nhật cấu hình chứng chỉ thành công",
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
				 * /exam/{exam_id}/certificate-template:
				 *   delete:
				 *     tags: [Certificate]
				 *     description: Delete certificate template for an exam (admin only)
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: exam_id
				 *         in: path
				 *         required: true
				 *         schema:
				 *           type: string
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */
				try {
					const examId = req.params.exam_id;
					await provider.deleteByExamId(examId);
					return res.sendOk({
						data: null,
						message: "Xóa cấu hình chứng chỉ thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
