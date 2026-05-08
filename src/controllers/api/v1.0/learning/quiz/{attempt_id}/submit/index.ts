import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { LearningQuizAttemptProvider } from "#providers/learningQuizAttemptProvider";
import { LearningQuizProvider } from "#providers/learningQuizProvider";
import { UserProvider } from "#providers/userProvider";
import { QuestionBankProvider } from "#providers/questionBankProvider";


export default (_express: Application) => {
	const attemptProvider = new LearningQuizAttemptProvider();
	const quizProvider = new LearningQuizProvider();
	const userProvider = new UserProvider();
	const questionProvider = new QuestionBankProvider();

	return <Resource>{
		put: {
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/quiz/{attempt_id}/submit:
				 *   put:
				 *     tags: [Learning Quiz]
				 *     description: Submit quiz attempt with optimized O(1) scoring
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: attempt_id
				 *         in: path
				 *         required: true
				 *         schema:
				 *           type: string
				 *     requestBody:
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             properties:
				 *               answers:
				 *                 type: array
				 *                 items:
				 *                   type: object
				 *                   properties:
				 *                     question_id:
				 *                       type: string
				 *                     user_answer:
				 *                       type: string
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const attemptId = req.params.attempt_id;
					const { answers } = req.body;

					const attempt = await attemptProvider.getAttemptById(attemptId);

					if (!attempt) {
						throw new Error("Không tìm thấy bài ôn tập");
					}

					if (attempt.user_id.toString() !== (userId as any).toString()) {
						throw new Error("Không có quyền truy cập bài ôn tập này");
					}

					if (attempt.status !== "in_progress") {
						throw new Error("Bài ôn tập này đã được nộp");
					}

					// Get quiz info
					const quizId = (attempt.quiz_id as any)?._id?.toString() || attempt.quiz_id?.toString() || '';
					const quiz = await quizProvider.getById(quizId);

					// OPTIMIZED SCORING: O(1) with Hash Map
					// Handle both array and object cases
					let questionIds: string[] = [];
					if (Array.isArray(attempt.shuffled_questions)) {
						// Normal case: shuffled_questions is ObjectId[]
						questionIds = attempt.shuffled_questions.map((id) => id.toString());
					} else if (attempt.shuffled_questions && typeof attempt.shuffled_questions === 'object') {
						// Fallback case: extract keys from object
						questionIds = Object.keys(attempt.shuffled_questions);
					}

					let questions;
					try {
						questions = await questionProvider.getAll({
							where: { _id: { $in: questionIds } },
							includes: [{ path: "answers" }]
						});
					} catch (error) {
						throw error;
					}

					// Create hash map for O(1) lookup
					const correctAnswersMap = new Map<string, string>();
					questions.rows.forEach(q => {
						const correctAnswer = q.answers.find((a: any) => a.is_correct)?._id?.toString();
						if (correctAnswer) {
							correctAnswersMap.set(q._id.toString(), correctAnswer);
						}
					});

					// Fast scoring - O(n) instead of O(n²)
					// Validate that all question_ids in answers exist in the attempt
					const validAnswers = answers.filter((answer: any) => {
						return correctAnswersMap.has(answer.question_id);
					});
					
					const processedAnswers = validAnswers.map((answer: any) => {
						const correctAnswer = correctAnswersMap.get(answer.question_id);
						const isCorrect = correctAnswer === answer.user_answer;
						return {
							...answer,
							is_correct: isCorrect
						};
					});
					
					const correctCount = processedAnswers.reduce((count, answer) => {
						return count + (answer.is_correct ? 1 : 0);
					}, 0);

					const totalQuestions = attempt.shuffled_questions.length;

					// Check if passed using quiz passing_score
					const passed = correctCount >= quiz.passing_score;

					// Update attempt with absolute score
					await attemptProvider.submitAttempt(
						attemptId,
						processedAnswers,
						0, // time_taken - calculate from start_time
						correctCount, // absolute score
						passed
					);

					return res.sendOk({
						data: {
							score: correctCount,
							total_score: totalQuestions, // Use actual number of questions in this attempt
							passed: passed,
							correct_answers: correctCount,
							total_questions: totalQuestions,
							attempt_id: attemptId
						},
						message: "Bài ôn tập đã được nộp thành công!"
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
