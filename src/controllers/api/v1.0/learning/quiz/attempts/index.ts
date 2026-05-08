import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { LearningQuizAttemptProvider } from "#providers/learningQuizAttemptProvider";
import { UserProvider } from "#providers/userProvider";
import { CertificateProvider } from "#providers/certificateProvider";

export default (_express: Application) => {
	const attemptProvider = new LearningQuizAttemptProvider();
	const userProvider = new UserProvider();
	const certificateProvider = new CertificateProvider();

	return <Resource>{
		get: {
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/quiz/attempts:
				 *   get:
				 *     tags: [Learning Quiz]
				 *     description: Get user's completed quiz attempts with certificate info
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: content_id
				 *         in: query
				 *         required: false
				 *         schema:
				 *           type: string
				 *         description: Filter by specific content
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const { content_id } = req.query;

					// Get user info for email
					const user = await userProvider.getById(userId.toString());

					// Get user's completed attempts
					const attempts = await attemptProvider.getAll({
						where: { 
							user_id: userId,
							status: "completed"
						},
						sortField: "created_at",
						sortOrder: "desc",
						includes: [
							{ path: "quiz_id", select: "title content_id" },
							{ path: "quiz_id.content_id", select: "title" }
						]
					});

					// Filter by content_id if provided
					const filteredAttempts = content_id 
						? attempts.rows.filter(attempt => 
							(attempt.quiz_id as any).content_id?.toString() === content_id.toString()
						)
						: attempts.rows;

					// Get certificate info for each attempt
					const attemptsWithCertificates = await Promise.all(
						filteredAttempts.map(async (attempt: any) => {
							const certificate = await certificateProvider.getByQuizAttemptId(attempt._id.toString());
							
							return {
								_id: attempt._id,
								quiz_id: attempt.quiz_id,
								quiz_title: (attempt.quiz_id as any).title,
								content_title: (attempt.quiz_id as any).content_id?.title || "Không có tiêu đề",
								score: attempt.score,
								passed: attempt.passed,
								status: attempt.status,
								completion_date: attempt.end_time || attempt.updated_at,
								attempt_number: attempt.attempt_number,
								certificate: certificate ? {
									_id: certificate._id,
									certificate_code: certificate.certificate_code,
									status: certificate.status,
									created_at: certificate.created_at
								} : null,
								can_download_certificate: !!certificate,
								user_email: user?.email || null
							};
						})
					);

					return res.sendOk({
						data: attemptsWithCertificates,
						message: "Lấy danh sách bài ôn tập đã hoàn thành thành công"
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
