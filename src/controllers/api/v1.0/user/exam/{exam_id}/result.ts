import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { UserProvider } from "#providers/userProvider";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";
import { queryFilter } from "#middlewares/query-filter";
import mongoose from "mongoose";

export default (_express: Application) => {
	const examProvider = new ExamProvider();
	const userProvider = new UserProvider();
	const examParticipantProvider = new ExamParticipantProvider();
	return <Resource>{
		get: {
			middleware: [verify, queryFilter],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/exam/{exam_id}/result:
				 *   get:
				 *     tags: [User]
				 *     description: Get exam result for participant
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: exam_id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam ID
				 *         required: true
				 *       - name: attempt_number
				 *         in: query
				 *         schema:
				 *           type: number
				 *         description: Lượt thi cần xem (1, 2, 3...). Mặc định = lượt mới nhất
				 *       - name: currentPage
				 *         in: query
				 *         schema:
				 *           type: number
				 *           default: 1
				 *         description: Page number for questions
				 *       - name: pageSize
				 *         in: query
				 *         schema:
				 *           type: number
				 *           default: 10
				 *         description: Number of questions per page
				 *       - name: filters
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Filter questions (type==MULTIPLE_CHOICE, type==ESSAY, is_correct==true, is_correct==false, is_correct==null)
				 *       - name: sortField
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Field to sort by
				 *       - name: sortOrder
				 *         in: query
				 *         schema:
				 *           type: string
				 *           enum: [asc, desc]
				 *         description: Sort order
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

					const examId = req.params.exam_id as string;
					const exam = await examProvider.validateAndFetchExam(examId);

					// Parse pagination params
					const currentPage = Math.max(1, parseInt(req.query.currentPage as string) || 1);
					const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 10));
					const attemptNumber = req.query.attempt_number ? parseInt(req.query.attempt_number as string) : undefined;

					// Get attempt from exam_participant
					let attempt;
					if (attemptNumber !== undefined && !isNaN(attemptNumber)) {
						attempt = await examParticipantProvider.getParticipantByExamAndUser(examId, userId.toString(), attemptNumber);
						if (!attempt) throw new Error(`Lượt thi số ${attemptNumber} không tồn tại`);
					} else {
						attempt = await examParticipantProvider.getLatestAttempt(examId, userId.toString());
						if (!attempt) throw new Error("Bạn chưa đăng ký kỳ thi này");
					}

					if (!attempt.start_time || !attempt.answers || attempt.answers.length === 0)
						throw new Error("Bạn chưa làm bài thi. Không thể xem kết quả.");
					if (attempt.status !== "submitted") throw new Error("Bạn chưa nộp bài thi. Không thể xem kết quả.");

					const data = await examParticipantProvider.getParticipantWithPopulatedQuestions(attempt._id!.toString());
					if (!data) throw new Error("Lấy kết quả bài thi của thí sinh thất bại");

					// Get filter and sort from payload (set by queryFilter middleware)
					const where = req.payload?.where || {};
					const sortField = req.payload?.sortField || null;
					const sortOrder = req.payload?.sortOrder || 'asc';

					// Filter and paginate questions
					let allQuestions = data.questions || [];
					const allAnswers = data.answers || [];

					// Apply type filter from where
					if (where.type) {
						allQuestions = allQuestions.filter((q: any) => q.type === where.type);
					}

					// Apply is_correct filter from where
					if (where.is_correct !== undefined) {
						const isCorrectValue = where.is_correct === null ? null : where.is_correct === 'true' || where.is_correct === true;
						allQuestions = allQuestions.filter((q: any) => {
							const answer = allAnswers.find((a: any) => a.question_id?.toString() === q._id?.toString());
							return answer?.is_correct === isCorrectValue;
						});
					}

					// Apply sorting
					if (sortField) {
						allQuestions.sort((a: any, b: any) => {
							let aVal = a[sortField];
							let bVal = b[sortField];
							if (sortOrder === 'desc') {
								[aVal, bVal] = [bVal, aVal];
							}
							if (aVal < bVal) return -1;
							if (aVal > bVal) return 1;
							return 0;
						});
					}

					const totalQuestions = allQuestions.length;
					const totalPages = Math.ceil(totalQuestions / pageSize);
					const startIndex = (currentPage - 1) * pageSize;
					const paginatedQuestions = allQuestions.slice(startIndex, startIndex + pageSize);

					// Filter answers for paginated questions only
					const paginatedQuestionIds = new Set(paginatedQuestions.map((q: any) => q._id?.toString()));
					const paginatedAnswers = allAnswers.filter((a: any) => paginatedQuestionIds.has(a.question_id?.toString()));

					return res.sendOk({
						data: {
							...data,
							questions: paginatedQuestions,
							answers: paginatedAnswers,
							// user_profile: {
							//   full_name: user?.last_name + ' ' + (user?.middle_name || '') + ' ' + user?.first_name,
							//   email: user?.email,
							//   phone: user?.phone,
							//   ...(user?.profile || {}),
							// },
							pagination: {
								count: totalQuestions,
								pageSize: pageSize,
								currentPage: currentPage,
								totalPages: totalPages,
							},
						},
						message: "Lấy kết quả bài thi của thí sinh thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
