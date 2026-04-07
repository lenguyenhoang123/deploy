import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";
import { UserProvider } from "#providers/userProvider";
import mongoose from "mongoose";

interface EssayScoreEntry {
	question_id: string;
	score: number;
	is_correct?: boolean;
}

interface EssayScoreRequest {
	scores: EssayScoreEntry[];
}

export default (_express: Application) => {
	const examParticipantProvider = new ExamParticipantProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		patch: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req<EssayScoreRequest>, res: Res) => {
				/**
				 * @openapi
				 * /exam-participant/{id}/essay-score:
				 *   patch:
				 *     tags: [Admin]
				 *     description: Grade essay answers for an exam participant
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam Participant ID (ResutlID)
				 *         required: true
				 *     requestBody:
				 *       description: Essay scores array with specific points
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             properties:
				 *               scores:
				 *                 type: array
				 *                 items:
				 *                   type: object
				 *                   properties:
				 *                     question_id:
				 *                       type: string
				 *                       description: Question ID
				 *                     score:
				 *                       type: number
				 *                       description: "Điểm từ 0 đến 1 (ví dụ: 0, 0.5, 1)"
				 *                     is_correct:
				 *                       type: boolean
				 *                       description: "true nếu có điểm > 0 (tùy chọn)"
				 *           example:
				 *             {
				 *               "scores": [
				 *                 {
				 *                   "question_id": "6699f4391c7ab023b0a77b5b",
				 *                   "score": 1,
				 *                   "is_correct": true
				 *                 }
				 *               ]
				 *             }
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

					const { scores } = req.body;
					if (!Array.isArray(scores) || scores.length === 0) {
						throw new Error("Danh sách điểm không hợp lệ");
					}

					// Validate each score entry
					for (const score of scores) {
						if (!score.question_id) {
							throw new Error("Mỗi điểm phải có question_id");
						}
						if (!mongoose.Types.ObjectId.isValid(score.question_id)) {
							throw new Error(`question_id ${score.question_id} không hợp lệ`);
						}
						if (typeof score.score !== "number" || score.score < 0 || score.score > 1) {
							throw new Error("score phải là số từ 0 đến 1");
						}
					}

					// Get participant with answers, exam and user info
					const participant = await examParticipantProvider.getById(participantId, {
						includes: [
							{ path: "exam_id", select: "name" },
							{ path: "user_id", select: "first_name last_name middle_name email phone" },
						],
					});
					if (!participant) {
						throw new Error("Không tìm thấy thông tin lượt thi");
					}

					// Check if already submitted
					if (participant.status !== "submitted") {
						throw new Error("Chỉ có thể chấm điểm sau khi thí sinh đã nộp bài");
					}

					// Check if already graded
					if (participant.is_graded) {
						throw new Error("Bài thi đã được chấm điểm, không thể chấm lại");
					}

					// Update essay scores
					const { newScore, updatedAnswers } = examParticipantProvider.updateEssayScores(
						participant.answers,
						scores
					);

					// Save to database
					const result = await examParticipantProvider.put(participantId, {
						answers: updatedAnswers,
						score: newScore,
						is_graded: true,
					});

					if (result.modifiedCount <= 0) {
						throw new Error("Có lỗi xảy ra khi cập nhật điểm");
					}

					return res.sendOk({
						data: {
							message: "Chấm điểm thành công",
							exam: participant.exam_id,
							user: participant.user_id,
							attempt_number: participant.attempt_number,
							new_score: newScore,
							graded_essays: scores.length,
						},
						message: "Chấm điểm tự luận thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
		put: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req<EssayScoreRequest>, res: Res) => {
				/**
				 * @openapi
				 * /exam-participant/{id}/essay-score:
				 *   put:
				 *     tags: [Admin]
				 *     description: Edit essay scores for an already graded exam participant
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam Participant ID (ResutlID)
				 *         required: true
				 *     requestBody:
				 *       description: Essay scores array with specific points
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             properties:
				 *               scores:
				 *                 type: array
				 *                 items:
				 *                   type: object
				 *                   properties:
				 *                     question_id:
				 *                       type: string
				 *                       description: Question ID
				 *                     score:
				 *                       type: number
				 *                       description: "Điểm từ 0 đến 1 (ví dụ: 0, 0.5, 1)"
				 *                     is_correct:
				 *                       type: boolean
				 *                       description: "true nếu có điểm > 0 (tùy chọn)"
				 *           example:
				 *             {
				 *               "scores": [
				 *                 {
				 *                   "question_id": "6699f4391c7ab023b0a77b5b",
				 *                   "score": 0.5,
				 *                   "is_correct": true
				 *                 }
				 *               ]
				 *             }
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

					const { scores } = req.body;
					if (!Array.isArray(scores) || scores.length === 0) {
						throw new Error("Danh sách điểm không hợp lệ");
					}

					// Validate each score entry
					for (const score of scores) {
						if (!score.question_id) {
							throw new Error("Mỗi điểm phải có question_id");
						}
						if (!mongoose.Types.ObjectId.isValid(score.question_id)) {
							throw new Error(`question_id ${score.question_id} không hợp lệ`);
						}
						if (typeof score.score !== "number" || score.score < 0 || score.score > 1) {
							throw new Error("score phải là số từ 0 đến 1");
						}
					}

					// Get participant with answers, exam and user info
					const participant = await examParticipantProvider.getById(participantId, {
						includes: [
							{ path: "exam_id", select: "name" },
							{ path: "user_id", select: "first_name last_name middle_name email phone" },
						],
					});
					if (!participant) {
						throw new Error("Không tìm thấy thông tin lượt thi");
					}

					// Check if submitted
					if (participant.status !== "submitted") {
						throw new Error("Chỉ có thể sửa điểm sau khi thí sinh đã nộp bài");
					}

					// Update essay scores
					const { newScore, updatedAnswers } = examParticipantProvider.updateEssayScores(
						participant.answers,
						scores
					);

					// Save to database (is_graded already true, no need to set again)
					const result = await examParticipantProvider.put(participantId, {
						answers: updatedAnswers,
						score: newScore,
					});

					if (result.modifiedCount <= 0) {
						throw new Error("Có lỗi xảy ra khi cập nhật điểm");
					}

					return res.sendOk({
						data: {
							message: "Sửa điểm thành công",
							exam: participant.exam_id,
							user: participant.user_id,
							attempt_number: participant.attempt_number,
							new_score: newScore,
							graded_essays: scores.length,
						},
						message: "Sửa điểm tự luận thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
