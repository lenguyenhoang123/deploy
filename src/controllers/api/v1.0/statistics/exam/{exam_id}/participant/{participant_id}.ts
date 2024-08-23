import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import mongoose from "mongoose";
import { UserProvider } from "#providers/userProvider";

export default (_express: Application) => {
	const provider = new ExamProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /statistics/exam/{exam_id}/participant/{participant_id}:
				 *   get:
				 *     tags: [Statistics]
				 *     description: Get exam statistics by ID.
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
				 *       - name: participant_id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Participant ID
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
					await userProvider.validateUserId(req.user.id as string);
					const examId = req.params.exam_id as string;
					const participantId = req.params.participant_id as string;
					if (!examId) throw new Error("Exam ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("Exam ID không hợp lệ");
					if (!participantId) throw new Error("Participant ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(participantId)) throw new Error("Participant ID không hợp lệ");

					const result = await provider.generateParticipantStatistics(examId, participantId);

					return res.sendOk({
						data: result,
						message: "Lấy kết quả thống kê thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
