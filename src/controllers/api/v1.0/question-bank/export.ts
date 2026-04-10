import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { QuestionBankProvider } from "#providers/questionBankProvider";
import { queryFilter } from "#middlewares/query-filter";
import { UserProvider } from "#providers/userProvider";
import { ExcelExportService } from "#services/excelExportService";

// Format question data for Excel export
function formatQuestionData(questions: any[]): any[] {
	return questions.map((q, index) => {
		const isMultipleChoice = q.type === "MULTIPLE_CHOICE";
		let correctAnswer = "";
		let answerOptions = "";

		if (isMultipleChoice && q.answers && q.answers.length > 0) {
			const correctAns = q.answers.find((a: any) => a.is_correct);
			correctAnswer = correctAns ? correctAns.value : "";
			answerOptions = q.answers.map((a: any, i: number) => `${String.fromCharCode(65 + i)}. ${a.value}`).join("\n");
		}

		return {
			stt: index + 1,
			question: q.name,
			type: q.type === "MULTIPLE_CHOICE" ? "Trắc nghiệm" : "Tự luận",
			level: q.level,
			priority: q.priority,
			answer_options: answerOptions,
			correct_answer: correctAnswer,
			created_at: q.created_at ? new Date(q.created_at).toLocaleDateString("vi-VN") : "",
		};
	});
}

// Headers for data export (read-friendly)
const questionHeaders = [
	{ header: "STT", key: "stt", width: 8 },
	{ header: "Câu hỏi", key: "question", width: 60 },
	{ header: "Loại", key: "type", width: 15 },
	{ header: "Độ khó", key: "level", width: 12 },
	{ header: "Ưu tiên", key: "priority", width: 10 },
	{ header: "Các đáp án", key: "answer_options", width: 50 },
	{ header: "Đáp án đúng", key: "correct_answer", width: 30 },
	{ header: "Ngày tạo", key: "created_at", width: 15 },
];

// Headers for import template (matches import structure)
const templateHeaders = [
	{ header: "STT", key: "stt", width: 8 },
	{ header: "Câu hỏi", key: "question", width: 60 },
	{ header: "Đáp án A", key: "answer_a", width: 30 },
	{ header: "Đáp án B", key: "answer_b", width: 30 },
	{ header: "Đáp án C", key: "answer_c", width: 30 },
	{ header: "Đáp án D", key: "answer_d", width: 30 },
	{ header: "Đáp án đúng", key: "correct_answer", width: 15 },
	{ header: "Loại", key: "type", width: 12 },
	{ header: "Độ khó", key: "level", width: 12 },
];

export default (_express: Application) => {
	const provider = new QuestionBankProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin, queryFilter],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /question-bank/export:
				 *   get:
				 *     tags: [Question Bank]
				 *     description: Export question bank to Excel. Use template=true for empty template file.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: filters
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Optional filter criteria for the questions (level, type, etc.)
				 *       - name: template
				 *         in: query
				 *         schema:
				 *           type: boolean
				 *           default: false
				 *         description: If true, returns empty template file with headers only
				 *       - name: includeDeleted
				 *         in: query
				 *         schema:
				 *           type: boolean
				 *           default: false
				 *         description: If true, includes soft-deleted questions in export
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
				 *             description: Excel file with question bank data
				 */

				try {
					await userProvider.validateUserId(req.user.id as string);

					// Check if template export (empty file with headers only)
					const isTemplate = req.query.template === "true";
					const includeDeleted = req.query.includeDeleted === "true";
					let formattedData: any[] = [];

					// Sample data for template
					if (isTemplate) {
						formattedData = [
							{
								stt: 1,
								question: "Câu hỏi trắc nghiệm mẫu?",
								answer_a: "Đáp án A",
								answer_b: "Đáp án B",
								answer_c: "Đáp án C",
								answer_d: "Đáp án D",
								correct_answer: "A",
								type: "MC(Trắc nghiệm)",
								level: "EASY",
							},
							{
								stt: 2,
								question: "Câu hỏi tự luận mẫu?",
								answer_a: "",
								answer_b: "",
								answer_c: "",
								answer_d: "",
								correct_answer: "",
								type: "ESSAY(Tự luận)",
								level: "NORMAL",
							},
						];
					}

					if (!isTemplate) {
						// Build where clause - filter deleted unless includeDeleted=true
						const whereClause = includeDeleted
							? req.payload.where
							: {
									...req.payload.where,
									$or: [{ is_deleted: false }, { is_deleted: undefined }],
							  };

						// Get all questions without pagination for export
						const queryOptions = {
							where: whereClause,
							pageSize: 10000, // Large number to get all
							currentPage: 1,
							attributes: [
								"name",
								"type",
								"level",
								"priority",
								"answers",
								"created_at",
							],
						};

						const result = await provider.getAll(queryOptions);
						const questions = result.rows || [];

						// Format data for Excel
						formattedData = formatQuestionData(questions);
					}

					// Generate styled Excel using service
					const useTemplate = isTemplate;
					const excelBuffer = await ExcelExportService.generateStyledMultiSheet([{
						sheetName: "Question Bank",
						title: useTemplate ? undefined : "NGÂN HÀNG CÂU HỎI",  // Template không có title
						data: formattedData,
						headers: useTemplate ? templateHeaders : questionHeaders,
						badgeColumn: useTemplate ? undefined : "type",
					}]);

					const timestamp = new Date().toISOString().split("T")[0];
					const filename = useTemplate
						? "QuestionBank_Template.xlsx"
						: `QuestionBank_Export_${timestamp}.xlsx`;
					res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
					res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
					return res.send(excelBuffer);
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
