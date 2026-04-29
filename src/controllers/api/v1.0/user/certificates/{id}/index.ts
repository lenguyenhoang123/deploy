import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { CertificateProvider } from "#providers/certificateProvider";

export default (_express: Application) => {
	const provider = new CertificateProvider();

	return <Resource>{
		get: {
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/certificates/{id}:
				 *   get:
				 *     tags: [Certificate]
				 *     description: Get certificate details by ID
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
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */
				try {
					const certificateId = req.params.id;
					const userId = req.user.id as string;

					const certificate = await provider.getById(certificateId);

					if (!certificate) {
						return res.sendError({ err: new Error("Chứng chỉ không tồn tại") });
					}

					// Check if certificate belongs to current user
					if (certificate.user_id.toString() !== userId) {
						return res.sendError({ err: new Error("Bạn không có quyền xem chứng chỉ này") });
					}

					return res.sendOk({ data: certificate });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
