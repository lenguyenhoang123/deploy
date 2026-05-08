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
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/learning:
				 *   get:
				 *     tags: [User Learning]
				 *     description: Get all learning content with user progress
				 *     security:
				 *       - Bearer: []
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */
				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);

					// Get all active content
					const contentResult = await contentProvider.getActiveContent({ populateFile: true });
					
					// Get user progress for all content
					const progressResult = await progressProvider.getUserProgress(userId);

					// Merge content with progress
					const contentWithProgress = contentResult.rows.map(content => {
						const progress = progressResult.rows.find(p => 
							p.content_id.toString() === content._id.toString()
						);
						
						return {
							_id: content._id,
							title: content.title,
							description: content.description,
							type: content.type,
							estimated_reading_time: content.estimated_reading_time,
							difficulty_level: content.difficulty_level,
							tags: content.tags,
							file: content.file_id,
							user_progress: progress || {
								status: "not_started",
								progress_percentage: 0,
								time_spent: 0
							},
							can_start_quiz: progress?.status === "completed"
						};
					});

					// Get overall statistics
					const completedCount = progressResult.rows.filter(p => p.status === "completed").length;
					const totalContent = contentResult.rows.length;
					const overallProgress = totalContent > 0 ? Math.round((completedCount / totalContent) * 100) : 0;

					return res.sendOk({
						data: {
							content: contentWithProgress,
							statistics: {
								total_content: totalContent,
								completed_content: completedCount,
								overall_progress: overallProgress
							}
						},
						message: "Lấy danh sách học tập thành công"
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
				 * /user/learning:
				 *   post:
				 *     tags: [User Learning]
				 *     description: Start learning content (create/update progress)
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             required: [content_id]
				 *             properties:
				 *               content_id:
				 *                 type: string
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const { content_id } = req.body;

					// Validate content exists
					const content = await contentProvider.getById(content_id);
					if (!content) {
						throw new Error("Nội dung học tập không tồn tại");
					}

					if (!content.is_active) {
						throw new Error("Nội dung học tập chưa được kích hoạt");
					}

					// Create or update progress
					const progress = await progressProvider.getOrCreateProgress(userId, content_id);

					return res.sendOk({
						data: {
							content: {
								_id: content._id,
								title: content.title,
								description: content.description,
								type: content.type,
								content: content.content,
								estimated_reading_time: content.estimated_reading_time,
								difficulty_level: content.difficulty_level,
								file: content.file_id
							},
							progress: progress
						},
						message: "Bắt đầu học tập thành công"
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
