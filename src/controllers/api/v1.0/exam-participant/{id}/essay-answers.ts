import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";
import { UserProvider } from "#providers/userProvider";
import mongoose from "mongoose";

export default (_express: Application) => {
	const examParticipantProvider = new ExamParticipantProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam-participant/{id}/essay-answers:
				 *   get:
				 *     tags: [Admin]
				 *     description: Get essay answers for grading (admin only)
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam Participant ID(resutl ID)
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
					const participantId = req.params.id as string;
					if (!participantId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(participantId)) {
						throw new Error("ID không hợp lệ");
					}

					await userProvider.validateUserId(req.user.id as string);

					// Get participant with populated questions, exam and user info
					const participant = await examParticipantProvider.getParticipantWithPopulatedQuestions(participantId) as any;
					if (!participant) {
						throw new Error("Không tìm thấy thông tin lượt thi");
					}

					// Get essay questions with answers
					const essayQuestions = (participant.questions || [])
						.filter((q: any) => q.type === "ESSAY")
						.map((q: any) => {
							const answer = participant.answers?.find(
								(a: any) => a.question_id?.toString() === q._id?.toString()
							);
							return {
								question_id: q._id,
								question_content: q.content,
								text_answer: answer?.text_answer || null,
								is_correct: answer?.is_correct ?? null,
								score: answer?.score ?? null, // Điểm số chi tiết
							};
						});

					const examData = participant.exam_id || {};
					const userData = participant.user_id || {};

					return res.sendOk({
						data: {
							participant_id: participant._id,
							exam_id: examData._id || participant.exam_id,
							exam_name: examData.name || null,
							user_id: userData._id || participant.user_id,
							user_name: userData.first_name || userData.last_name
								? `${userData.last_name || ""} ${userData.middle_name || ""} ${userData.first_name || ""}`.trim()
								: null,
							user_email: userData.email || null,
							attempt_number: participant.attempt_number,
							score: participant.score,
							status: participant.status,
							essay_questions: essayQuestions,
							essay_count: essayQuestions.length,
							graded_count: essayQuestions.filter((q: any) => q.is_correct !== null).length,
							pending_count: essayQuestions.filter((q: any) => q.is_correct === null).length,
						},
						message: "Lấy câu trả lời tự luận thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
