import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { LearningQuizAttemptProvider } from "#providers/learningQuizAttemptProvider";
import { LearningQuizProvider } from "#providers/learningQuizProvider";
import { LearningContentProvider } from "#providers/learningContentProvider";
import { UserProvider } from "#providers/userProvider";
import { QuestionBankProvider } from "#providers/questionBankProvider";

// Fisher-Yates shuffle algorithm for better randomization
function fisherYatesShuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Interface cho Mongoose document structure
interface IMongooseQuestion {
	_doc?: {
		_id: string;
		name: string;
		type: string;
		level: string;
		priority: number;
		answers: Array<{
			_id: string;
			value: string;
			is_correct: boolean;
		}>;
	};
}

interface ICleanQuestion {
	_id: string;
	name: string;
	type: string;
	level: string;
	priority: number;
	answers: Array<{
		_id: string;
		value: string;
		// is_correct removed to hide correct answers from users
	}>;
}

export default (_express: Application) => {
	const attemptProvider = new LearningQuizAttemptProvider();
	const quizProvider = new LearningQuizProvider();
	const contentProvider = new LearningContentProvider();
	const userProvider = new UserProvider();
	const questionBankProvider = new QuestionBankProvider();

	return <Resource>{
		post: {
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/quiz/start:
				 *   post:
				 *     tags: [Learning Quiz]
				 *     description: Start a new learning quiz attempt
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             properties:
				 *               content_id:
				 *                 type: string
				 *                 description: Content ID to start quiz for
				 *               num_questions:
				 *                 type: number
				 *                 description: Number of questions to include (optional)
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const { content_id, num_questions } = req.body;

					if (!content_id) {
						throw new Error("Content ID là bắt buộc");
					}

					// Check if user already has an in-progress attempt for this content
					const existingAttempts = await attemptProvider.getAll({
						where: {
							user_id: userId,
							status: "in_progress"
						},
						includes: [
							{ path: "quiz_id", select: "title content_id time_limit passing_score" }
						]
					});
					
					const existingAttempt = existingAttempts.rows.find(attempt => 
						(attempt.quiz_id as any)?.content_id?.toString() === content_id
					);

					if (existingAttempt) {
						// Return existing attempt with cleaned questions (hide answers)
						const populatedAttempt = await attemptProvider.getAttemptById(existingAttempt._id.toString());
						
						// Clean existing questions to hide correct answers
						const cleanedExistingQuestions = (populatedAttempt.shuffled_questions as any[]).map(q => ({
							_id: q._id,
							name: q.name,
							type: q.type,
							level: q.level,
							priority: q.priority,
							answers: (q.answers || []).map((answer: any) => ({
								_id: answer._id,
								value: answer.value
								// Remove is_correct to hide correct answer
							}))
						}));
						
						return res.sendOk({
							data: {
								attempt_id: populatedAttempt._id,
								quiz_info: {
									title: (populatedAttempt.quiz_id as any)?.title,
									time_limit: (populatedAttempt.quiz_id as any)?.time_limit
									// passing_score removed - lấy theo min score
								},
								questions: cleanedExistingQuestions,
								start_time: populatedAttempt.start_time,
								end_time: populatedAttempt.end_time,
								is_practice: true
							},
							message: "Tiếp tục bài ôn tập hiện tại"
						});
					}

					// Get quiz for this content
					let quiz = await quizProvider.getQuizByContentId(content_id);
					
					// Auto-create quiz if not exists
					if (!quiz) {
						console.log(`🔧 Auto-creating quiz for content: ${content_id}`);
						
						// Get questions from question bank
						const allQuestions = await questionBankProvider.getAll({
							where: { 
								is_deleted: false,
								type: "MULTIPLE_CHOICE"
							},
							pageSize: 50
						});
						
						if (allQuestions.rows.length < 1) {
							throw new Error("Không đủ câu hỏi trong ngân hàng để tạo quiz (tối thiểu 1 câu)");
						}
						
						// Create quiz with available questions
						const quizQuestions = allQuestions.rows.slice(0, 20);
						
						quiz = await quizProvider.createQuiz({
							content_id: content_id as any,
							title: "Quiz ôn tập",
							description: "Bài trắc nghiệm ôn tập tự động tạo",
							passing_score: 16, // 80% of 20 questions
							total_score: quizQuestions.length, // 1 point per question
							time_limit: 20,
							questions: quizQuestions.map(q => q._id),
							shuffle_questions: true,
							shuffle_answers: true,
							is_active: true
						});
						
						console.log(`✅ Created quiz with ${quizQuestions.length} questions for content: ${content_id}`);
					}

					// Get questions from question bank
					const questionCount = num_questions || 10;
					
					// Only get MULTIPLE_CHOICE questions
					const questions = await questionBankProvider.getRandomQuestionsByType(questionCount, "MULTIPLE_CHOICE");

					if (!questions || questions.length === 0) {
						throw new Error("Không tìm thấy câu hỏi trắc nghiệm nào trong ngân hàng câu hỏi");
					}

					// Convert to proper format with answers
					const questionsWithAnswers = await Promise.all(
						questions.map(async (q) => {
							const questionWithAnswers = await questionBankProvider.getById(q._id.toString(), {
								attributes: ["name", "type", "level", "priority", "answers"]
							});
							return questionWithAnswers;
						})
					);

					// Shuffle questions if enabled (using Fisher-Yates for better randomization)
					let shuffledQuestions = [...questionsWithAnswers];
					if (quiz.shuffle_questions) {
						shuffledQuestions = fisherYatesShuffle(shuffledQuestions);
					}

					// Limit number of questions if specified
					const finalQuestions = num_questions 
						? shuffledQuestions.slice(0, num_questions)
						: shuffledQuestions;

					// Update total_score based on actual number of questions for this attempt
					const actualTotalScore = finalQuestions.length;

					// Shuffle answers for each question if enabled
					const questionsWithShuffledAnswers = finalQuestions.map(q => {
						const question = { ...q };
						if (quiz.shuffle_answers && question.answers) {
							const shuffledAnswers = [...question.answers].sort(() => Math.random() - 0.5);
							question.answers = shuffledAnswers;
						}
						return question;
					});

					// Clean question data - extract only needed properties from Mongoose documents (hide correct answers)
					const cleanQuestions: ICleanQuestion[] = questionsWithShuffledAnswers.map(q => {
						const mongoQ = q as IMongooseQuestion;
						return {
							_id: mongoQ._doc?._id || '',
							name: mongoQ._doc?.name || '',
							type: mongoQ._doc?.type || '',
							level: mongoQ._doc?.level || '',
							priority: mongoQ._doc?.priority || 0,
							answers: (mongoQ._doc?.answers || []).map(answer => ({
								_id: answer._id,
								value: answer.value
								// Remove is_correct to hide the correct answer
							}))
						};
					});

					// Validate all questions have _id (access from _doc for Mongoose documents)
					const validQuestions = questionsWithShuffledAnswers.filter(q => {
						const mongoQ = q as IMongooseQuestion;
						return mongoQ._doc && mongoQ._doc._id;
					});
					const invalidQuestions = questionsWithShuffledAnswers.filter(q => {
						const mongoQ = q as IMongooseQuestion;
						return !mongoQ._doc || !mongoQ._doc._id;
					});
					
					if (invalidQuestions.length > 0) {
						throw new Error(`Có ${invalidQuestions.length} câu hỏi không có ID hợp lệ`);
					}

					const questionIds = validQuestions.map(q => {
						const mongoQ = q as IMongooseQuestion;
						return mongoQ._doc!._id.toString();
					});

					// Get next attempt number for this user and quiz
					const userAttempts = await attemptProvider.getAll({
						where: {
							user_id: userId,
							quiz_id: quiz._id.toString()
						},
						sortField: "attempt_number",
						sortOrder: "desc",
						pageSize: 1
					});

					const nextAttemptNumber = userAttempts.rows.length > 0 
						? (userAttempts.rows[0] as any).attempt_number + 1 
						: 1;

					// Create new attempt
					const newAttempt = await attemptProvider.createAttempt(
						userId.toString(),
						quiz._id.toString(),
						nextAttemptNumber, // dynamic attempt_number
						questionIds,
						questionsWithShuffledAnswers.reduce((acc, q) => {
							const mongoQ = q as IMongooseQuestion;
							if (mongoQ._doc && mongoQ._doc._id && mongoQ._doc.answers) {
								const questionId = mongoQ._doc._id.toString();
								acc[questionId] = mongoQ._doc.answers
									.map(a => a._id?.toString())
									.filter((id): id is string => Boolean(id));
							}
							return acc;
						}, {} as Record<string, string[]>)
					);

					// Populate attempt with full question data
					const populatedAttempt = await attemptProvider.getAttemptById(newAttempt._id.toString());

					return res.sendOk({
						data: {
							attempt_id: populatedAttempt._id,
							quiz_info: {
								title: quiz.title,
								time_limit: quiz.time_limit,
								
								total_score: actualTotalScore
							},
							questions: cleanQuestions,
							start_time: populatedAttempt.start_time,
							end_time: populatedAttempt.end_time,
							is_practice: true
						},
						message: "Bắt đầu bài ôn tập thành công"
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
