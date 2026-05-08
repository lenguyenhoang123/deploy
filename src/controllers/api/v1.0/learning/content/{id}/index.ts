import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { LearningContentProvider } from "#providers/learningContentProvider";
import { UserProvider } from "#providers/userProvider";

export default (_express: Application) => {
	const contentProvider = new LearningContentProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		put: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/content/{id}:
				 *   put:
				 *     tags: [Learning]
				 *     description: Update learning content (admin only)
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
				 *               title:
				 *                 type: string
				 *               description:
				 *                 type: string
				 *               is_active:
				 *                 type: boolean
				 *                 description: Set to false to soft delete
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const contentId = req.params.id;

					// Check if content exists
					const existingContent = await contentProvider.getOne({
						where: { _id: contentId }
					});

					if (!existingContent) {
						throw new Error("Nội dung học tập không tồn tại");
					}

					// Update content
					await contentProvider.put(contentId, {
						...req.body,
						updated_by: userId,
					});

					// Fetch updated content
					const updatedContent = await contentProvider.getById(contentId);

					return res.sendOk({
						data: updatedContent,
						message: "Cập nhật nội dung học tập thành công"
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
				 * /learning/content/{id}:
				 *   delete:
				 *     tags: [Learning]
				 *     description: Soft delete learning content (admin only)
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

					// Check if content exists
					const existingContent = await contentProvider.getOne({
						where: { _id: contentId }
					});

					if (!existingContent) {
						throw new Error("Nội dung học tập không tồn tại");
					}

					// Soft delete by setting is_active to false
					const deletedContent = await contentProvider.put(contentId, {
						is_active: false,
						updated_by: userId,
					});

					return res.sendOk({
						data: deletedContent,
						message: "Xóa nội dung học tập thành công"
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
