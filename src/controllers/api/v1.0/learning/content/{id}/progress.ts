import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { LearningProgressProvider } from "#providers/learningProgressProvider";
import { UserProvider } from "#providers/userProvider";

export default (_express: Application) => {
	const progressProvider = new LearningProgressProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		put: {
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/content/{id}/progress:
				 *   put:
				 *     tags: [Learning]
				 *     description: Update reading progress for content
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
				 *             properties:
				 *               progress_percentage:
				 *                 type: number
				 *                 minimum: 0
				 *                 maximum: 100
				 *               time_spent:
				 *                 type: number
				 *                 description: Time spent in minutes
				 *               scroll_position:
				 *                 type: number
				 *               last_position:
				 *                 type: string
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const contentId = req.params.id;

					const { progress_percentage, time_spent, scroll_position, last_position } = req.body;

					const updatedProgress = await progressProvider.updateProgress(
						userId,
						contentId,
						{
							progress_percentage,
							time_spent,
							scroll_position,
							last_position,
						}
					);

					return res.sendOk({
						data: updatedProgress,
						message: "Cập nhật tiến độ học tập thành công"
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		get: {
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/content/{id}/progress:
				 *   get:
				 *     tags: [Learning]
				 *     description: Get progress for specific content
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
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const contentId = req.params.id;

					const progress = await progressProvider.getOrCreateProgress(userId, contentId);

					return res.sendOk({
						data: progress,
						message: "Lấy tiến độ học tập thành công"
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
