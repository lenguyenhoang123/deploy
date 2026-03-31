import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { UserProvider } from "#providers/userProvider";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";

export default (_express: Application) => {
	const examProvider = new ExamProvider();
	const userProvider = new UserProvider();
	const examParticipantProvider = new ExamParticipantProvider();
	return <Resource>{
		get: {
			middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/exam/{exam_id}/attempts:
				 *   get:
				 *     tags: [User]
				 *     description: Get remaining attempts info for an exam
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

					const maxAttempts = exam.max_attempts || 1;
					const usedAttempts = await examParticipantProvider.getAttemptsCount(examId, userId.toString());
					const remainingAttempts = Math.max(0, maxAttempts - usedAttempts);

					return res.sendOk({
						data: {
							used: usedAttempts,
							remaining: remainingAttempts,
							max: maxAttempts,
						},
						message: "Lấy thông tin lượt thi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
