import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { LearningContentProvider } from "#providers/learningContentProvider";
import { LearningProgressProvider } from "#providers/learningProgressProvider";
import { UserProvider } from "#providers/userProvider";

export default (_express: Application) => {
	const contentProvider = new LearningContentProvider();
	const progressProvider = new LearningProgressProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		get: {
			middleware: [],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/content:
				 *   get:
				 *     tags: [Learning]
				 *     description: Get all active learning content (public access, no auth required)
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */
				try {
					// Get all active content
					const contentResult = await contentProvider.getActiveContent({ populateFile: true });
					
					// Check if user is authenticated
					const userId = req.user?.id;
					
					let contentWithProgress;
					
					if (userId) {
						// User is logged in - get progress
						const progressResult = await progressProvider.getUserProgress(userId as string);
						
						// Merge content with progress
						contentWithProgress = contentResult.rows.map(content => {
							const progress = progressResult.rows.find(p => 
								p.content_id.toString() === content._id.toString()
							);
							
							return {
								...content.toObject(),
								user_progress: progress || {
									status: "not_started",
									progress_percentage: 0,
									time_spent: 0
								}
							};
						});
					} else {
						// Public access - no progress data
						contentWithProgress = contentResult.rows.map(content => ({
							...content.toObject(),
							user_progress: null
						}));
					}

					return res.sendOk({
						data: {
							...contentResult,
							rows: contentWithProgress
						},
						message: "Lấy danh sách nội dung học tập thành công"
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		post: {
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/content:
				 *   post:
				 *     tags: [Learning]
				 *     description: Create new learning content (admin only)
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             required: [title, description, type, content, estimated_reading_time]
				 *             properties:
				 *               title:
				 *                 type: string
				 *               description:
				 *                 type: string
				 *               type:
				 *                 type: string
				 *                 enum: [reading_material, video_content, interactive_content]
				 *               content:
				 *                 type: string
				 *               estimated_reading_time:
				 *                 type: number
				 *               difficulty_level:
				 *                 type: string
				 *                 enum: [easy, medium, hard]
				 *               tags:
				 *                 type: array
				 *                 items:
				 *                   type: string
				 *               slug:
				 *                 type: string
				 *                 description: URL-friendly identifier (optional)
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);

					// Auto-generate slug if not provided
					const slug = req.body.slug || req.body.title
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, '-')
						.replace(/(^-|-$)/g, '');

					const data = await contentProvider.post({
						...req.body,
						slug,
						created_by: userId,
					});

					return res.sendOk({
						data,
						message: "Tạo nội dung học tập thành công"
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
