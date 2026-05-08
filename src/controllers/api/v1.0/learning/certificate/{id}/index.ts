import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { CertificateProvider } from "#providers/certificateProvider";

export default (_express: Application) => {
	const certificateProvider = new CertificateProvider();

	return <Resource>{
		get: {
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/certificate/{id}:
				 *   get:
				 *     tags: [Learning Certificate]
				 *     description: Get certificate by ID
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
					const { id } = req.params;

					if (!id) {
						throw new Error("Certificate ID là bắt buộc");
					}

					const certificate = await certificateProvider.getById(id, {
						includes: [
							{ path: "user_id", select: "email first_name middle_name last_name profile" },
							{ path: "quiz_id", select: "title content_id" },
							{ path: "content_id", select: "title" },
							{ path: "template_id", select: "name template_url" }
						]
					});

					if (!certificate) {
						throw new Error("Không tìm thấy chứng chỉ");
					}

					return res.sendOk({
						data: certificate,
						message: "Lấy thông tin chứng chỉ thành công"
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
