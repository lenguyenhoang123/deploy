import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { UserProvider } from "#providers/userProvider";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";
import mongoose from "mongoose";

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

					// Get latest attempt from exam_participant
					const latestAttempt = await examParticipantProvider.getLatestAttempt(examId, userId.toString());
					if (!latestAttempt) throw new Error("Bạn chưa đăng ký kỳ thi này");

					if (!latestAttempt.start_time || !latestAttempt.answers || latestAttempt.answers.length === 0)
						throw new Error("Bạn chưa làm bài thi. Không thể xem kết quả.");
					if (latestAttempt.status !== "submitted") throw new Error("Bạn chưa nộp bài thi. Không thể xem kết quả.");

					const data = await examParticipantProvider.getParticipantWithPopulatedQuestions(latestAttempt._id!.toString());
					if (!data) throw new Error("Lấy kết quả bài thi của thí sinh thất bại");

					// Get user profile
					const user = await userProvider.getById(userId.toString());
					const userProfile = {
						full_name: user ? `${user.last_name} ${user.middle_name || ""} ${user.first_name}`.trim() : "",
						email: user?.email,
						phone: user?.phone,
						...(user?.profile || {}),
					};

					return res.sendOk({
						data: {
							...data,
							user_profile: userProfile,
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
