import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { IExam, IParticipantAnswer } from "#models/exam";
import { UserProvider } from "#providers/userProvider";
import { validateSubmitExamEntry } from "#middlewares/validator";

export default (_express: Application) => {
	const examProvider = new ExamProvider();
	const userProvider = new UserProvider();
	return <Resource>{
		put: {
			middleware: [verify, validateSubmitExamEntry],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /user/exam/{exam_id}/submit:
				 *   put:
				 *     tags: [User]
				 *     description: Submit an exam
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: exam_id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam ID to submit
				 *         required: true
				 *     requestBody:
				 *       description: Participant Answers with start and submit times
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             $ref: '#/components/schemas/SubmitParticipantAnswers'
				 *           example:
				 *              {
				 *                "start_time": "2024-08-21T09:00:00Z",
				 *                "submit_time": "2024-08-21T10:00:00Z",
				 *                "answers": [
				 *                  {
				 *                    "question_id": "6699f4391c7ab023b0a77b5b",
				 *                    "user_answer": "6699f4391c7ab023b0a77b5b"
				 *                  },
				 *                  {
				 *                    "question_id": "6699f4391c7ab023b0a77b5b",
				 *                    "user_answer": ""
				 *                  }
				 *                ]
				 *              }
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					let { start_time, submit_time, answers } = req.body;
					start_time = new Date(start_time);
					submit_time = new Date(submit_time);

					const examId = req.params.exam_id as string;
					const exam = await examProvider.validateAndFetchExam(examId);

					if (start_time < exam.start_time)
						throw new Error("Thời gian bắt đầu không hợp lệ. Không thể bắt đầu làm bài trước khi diễn ra kỳ thi.");
					if (submit_time > exam.end_time)
						throw new Error("Thời gian nộp bài không hợp lệ. Không thể nộp bài khi kỳ thi đã kết thúc.");

					if (examProvider.calculateTimeTakenInMinutes(start_time, submit_time) > exam.allowed_time)
						throw new Error("Thời gian làm bài không thể lớn hơn thời gian cho phép.");

					const userId = await userProvider.getUserIdFromRequest(req);

					let participant = exam.participants.find((p) => p.user_id.toString() === userId.toString());
					if (!participant) throw new Error("Bạn chưa đăng ký kỳ thi này");

					if (!participant.answers || participant.answers.length === 0)
						throw new Error("Bạn chưa bắt đầu bài thi. Không thể nộp bài.");
					if (participant.submit_time) throw new Error("Bạn đã hoàn thành bài thi. Không thể nộp bài.");

					// Submit Participant Answers
					participant.start_time = start_time;
					participant.submit_time = submit_time;
					participant.answers = await updateParticipantAnswersWithSubmittedAnswers(participant.answers, answers);

					const remainingParticipants = exam.participants.filter((p) => p.user_id.toString() !== userId.toString());
					const updatedParticipants = [...remainingParticipants, participant];

					const data = await exam.updateOne({
						participants: updatedParticipants,
					});

					if (data.modifiedCount <= 0) throw new Error("Có lỗi xảy ra khi nộp bài thi");
					return res.sendOk({ data: { message: "Nộp bài thi thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};

	async function updateParticipantAnswersWithSubmittedAnswers(
		originalAnswers: IParticipantAnswer[],
		newSubmittedAnswers: IParticipantAnswer[],
	): Promise<IParticipantAnswer[]> {
		const answerMap = new Map(
			newSubmittedAnswers.map(({ question_id, user_answer }) => [question_id.toString(), user_answer]),
		);
		return originalAnswers.map((answer) => ({
			...answer,
			user_answer: answerMap.get(answer.question_id.toString()) || answer.user_answer,
		}));
	}
};
