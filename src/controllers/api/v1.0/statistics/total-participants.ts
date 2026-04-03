import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";

export default (_express: Application) => {
	const provider = new ExamParticipantProvider();

	return <Resource>{
		get: {
			middleware: [],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /statistics/total-participants:
				 *   get:
				 *     tags: [Statistics]
				 *     description: Get total participants and attempts count (public API).
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					const stats = await provider.getTotalParticipantsStats();

					return res.sendOk({
						data: stats,
						message: "Lấy tổng số lượt tham gia thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
