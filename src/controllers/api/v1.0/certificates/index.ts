import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { CertificateProvider } from "#providers/certificateProvider";

export default (_express: Application) => {
	const provider = new CertificateProvider();

	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /certificates:
				 *   get:
				 *     tags: [Admin]
				 *     description: Get all certificates (admin only) with pagination and filters
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: currentPage
				 *         in: query
				 *         schema:
				 *           type: number
				 *           default: 1
				 *       - name: pageSize
				 *         in: query
				 *         schema:
				 *           type: number
				 *           default: 20
				 *       - name: exam_id
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Filter by exam ID
				 *       - name: user_id
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Filter by user ID
				 *       - name: status
				 *         in: query
				 *         schema:
				 *           type: string
				 *           enum: [active, revoked, expired]
				 *         description: Filter by certificate status
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */
				try {
					const { currentPage, pageSize, exam_id, user_id, status } = req.query;

					const where: any = {};
					if (exam_id) where.exam_id = exam_id;
					if (user_id) where.user_id = user_id;
					if (status) where.status = status;

					const result = await provider.getAll({
						where,
						currentPage: currentPage ? parseInt(currentPage as string) : 1,
						pageSize: pageSize ? parseInt(pageSize as string) : 20,
						sortField: "created_at",
						sortOrder: "desc",
						includes: [
							{ path: "exam_id", select: "name" },
							{ path: "user_id", select: "first_name last_name middle_name email phone" },
						],
					});

					return res.sendOk({
						data: result,
						message: "Lấy danh sách chứng chỉ thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
