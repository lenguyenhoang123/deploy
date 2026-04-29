import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { CertificateProvider } from "#providers/certificateProvider";

export default (_express: Application) => {
	const provider = new CertificateProvider();

	return <Resource>{
		get: {
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /certificates/verify:
				 *   get:
				 *     tags: [Certificate]
				 *     description: Verify certificate by code (public)
				 *     parameters:
				 *       - name: code
				 *         in: query
				 *         required: true
				 *         schema:
				 *           type: string
				 *         description: Certificate code to verify
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */
				try {
					const { code } = req.query;

					if (!code || typeof code !== "string") {
						return res.sendError({ err: new Error("Vui lòng cung cấp mã chứng chỉ") });
					}

					const certificate = await provider.getByCode(code);

					if (!certificate) {
						return res.sendOk({
							data: { valid: false },
							message: "Mã chứng chỉ không tồn tại",
						});
					}

					const isValid = certificate.status === "active";

					return res.sendOk({
						data: {
							valid: isValid,
							certificate: isValid
								? {
										certificate_code: certificate.certificate_code,
										user_info: certificate.user_info,
										exam_info: certificate.exam_info,
										created_at: certificate.created_at,
								  }
								: null,
							message: isValid
								? "Chứng chỉ hợp lệ"
								: certificate.status === "revoked"
									? `Chứng chỉ đã bị thu hồi: ${certificate.revoked_reason || "Không có lý do"}`
									: "Chứng chỉ không hợp lệ",
						},
						message: isValid ? "Chứng chỉ hợp lệ" : "Chứng chỉ không hợp lệ",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
