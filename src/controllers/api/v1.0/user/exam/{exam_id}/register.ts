import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { UserProvider } from "#providers/userProvider";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";
import { ExamParticipantStatus } from "#models/examParticipant";
import mongoose from "mongoose";

export default (_express: Application) => {
	const examProvider = new ExamProvider();
	const userProvider = new UserProvider();
	const examParticipantProvider = new ExamParticipantProvider();
	return <Resource>{
		put: {
			middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/exam/{exam_id}/register:
				 *   put:
				 *     tags: [User]
				 *     description: Register an exam
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: exam_id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam ID to register
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
					const currentTime = new Date();
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);

					const examId = req.params.exam_id as string;
					const exam = await examProvider.validateAndFetchExam(examId);

					if (currentTime > exam.end_time) throw new Error("Kỳ thi đã hết hạn đăng ký");

					// Check if already registered using new ExamParticipant model
					const existingParticipant = await examParticipantProvider.getParticipantByExamAndUser(
						examId,
						userId.toString()
					);
					if (existingParticipant) {
						return res.sendOk({ data: { message: "Bạn đã đăng ký kỳ thi này trước đó" } });
					}

					// Create registered participant
					await examParticipantProvider.post({
						exam_id: new mongoose.Types.ObjectId(examId) as any,
						user_id: new mongoose.Types.ObjectId(userId.toString()) as any,
						attempt_number: 1,
						status: ExamParticipantStatus.REGISTERED,
						questions: [],
						answers: [],
					});

					return res.sendOk({ data: { message: "Đăng ký thi thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
