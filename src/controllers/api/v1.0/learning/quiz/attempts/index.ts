import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { LearningQuizAttemptProvider } from "#providers/learningQuizAttemptProvider";
import { UserProvider } from "#providers/userProvider";
import { CertificateProvider } from "#providers/certificateProvider";
import { queryFilter } from "#middlewares/query-filter";

interface PopulatedQuiz {
	_id: string;
	title: string;
	content_id: {
		_id: string;
		title: string;
	} | string;
}

interface PopulatedAttempt {
	_id: import("mongoose").Types.ObjectId;
	quiz_id: PopulatedQuiz;
	score: number;
	passed: boolean;
	status: string;
	end_time?: Date;
	updated_at: Date;
	attempt_number: number;
}

/** Normalize learning content id whether quiz.content_id is an ObjectId or a populated { _id, ... } doc */
function contentIdFromQuiz(quiz: any): string | null {
	if (!quiz?.content_id) return null;
	const c = quiz.content_id;
	if (typeof c === "object" && c !== null && "_id" in c) {
		return String((c as { _id: unknown })._id);
	}
	return String(c);
}

export default (_express: Application) => {
	const attemptProvider = new LearningQuizAttemptProvider();
	const userProvider = new UserProvider();
	const certificateProvider = new CertificateProvider();

	return <Resource>{
		get: {
			middleware: [verify, queryFilter],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/quiz/attempts:
				 *   get:
				 *     tags: [Learning Quiz]
				 *     description: Get user's submitted quiz attempts (passed or failed) with certificate info
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: content_id
				 *         in: query
				 *         required: false
				 *         schema:
				 *           type: string
				 *         description: Filter by specific content
				 *       - name: currentPage
				 *         in: query
				 *         required: false
				 *         schema:
				 *           type: integer
				 *           default: 1
				 *         description: Current page number
				 *       - name: pageSize
				 *         in: query
				 *         required: false
				 *         schema:
				 *           type: integer
				 *           default: 10
				 *         description: Number of items per page
				 *       - name: filters
				 *         in: query
				 *         required: false
				 *         schema:
				 *           type: string
				 *         description: Optional filter criteria for attempts
				 *       - name: sortField
				 *         in: query
				 *         required: false
				 *         schema:
				 *           type: string
				 *           example: created_at
				 *         description: Field to sort attempts by
				 *       - name: sortOrder
				 *         in: query
				 *         required: false
				 *         schema:
				 *           type: string
				 *           enum: [asc, desc]
				 *           example: desc
				 *         description: Sort order, either ascending (asc) or descending (desc)
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const { content_id, currentPage = 1, pageSize = 10 } = req.query;

					// Get user info for email
					const user = await userProvider.getById(userId.toString());

					// Build base where clause
					const whereClause: Record<string, unknown> = {
						user_id: userId,
						status: { $in: ["completed", "failed"] },
					};

					// Add content_id filter if provided
					if (content_id) {
						whereClause["quiz_id.content_id"] = content_id;
					}

					// Merge with any additional filters from queryFilter middleware
					if (req.payload?.where) {
						Object.assign(whereClause, req.payload.where);
					}

					// Submitted attempts: completed (passed) or failed (submitted but below passing score)
					const attempts = await attemptProvider.getAll({
						where: whereClause,
						sortField: req.payload?.sortField || "created_at",
						sortOrder: req.payload?.sortOrder || "desc",
						currentPage: parseInt(currentPage as string),
						pageSize: parseInt(pageSize as string),
						includes: [
							{ path: "quiz_id", select: "title content_id" },
							{ path: "quiz_id.content_id", select: "title" },
						],
					});

					// Get certificate info for each attempt
					const attemptsWithCertificates = await Promise.all(
						(attempts.rows as unknown as PopulatedAttempt[]).map(async (attempt) => {
							const certificate = await certificateProvider.getByQuizAttemptId(attempt._id.toString());
							
							return {
								_id: attempt._id.toString(),
								quiz_id: attempt.quiz_id,
								quiz_title: attempt.quiz_id?.title || "Không có tiêu đề",
								content_title: typeof attempt.quiz_id?.content_id === 'object' 
									? attempt.quiz_id.content_id.title 
									: "Không có tiêu đề",
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
						data: {
							rows: attemptsWithCertificates,
							currentPage: attempts.currentPage,
							totalPages: attempts.totalPages,
							total: attempts.count
						},
						message: "Lấy danh sách bài ôn tập đã hoàn thành thành công"
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
