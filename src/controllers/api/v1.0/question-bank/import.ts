import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { QuestionBankProvider } from "#providers/questionBankProvider";
import { UserProvider } from "#providers/userProvider";
import { DifficultyLevels, QuestionTypes, IQuestionBank } from "#models/questionBank";
import upload from "#services/file-system-handlers/uploadFileService";
import fs from "fs";
import ExcelJS from "exceljs";
import mongoose from "mongoose";

interface ParsedQuestion {
	name: string;
	type: string;
	level: string;
	priority: number;
	answers: { value: string; is_correct: boolean }[];
}

export default (_express: Application) => {
	const provider = new QuestionBankProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		post: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /question-bank/import:
				 *   post:
				 *     tags: [Question Bank]
				 *     description: Import questions from Excel file (MC + Essay)
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *       description: Excel file with questions
				 *       required: true
				 *       content:
				 *         multipart/form-data:
				 *           schema:
				 *             type: object
				 *             properties:
				 *               file:
				 *                 type: string
				 *                 format: binary
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				let uploadedFilePath: string | null = null;

				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);

					// Upload file
					await upload(req, res);
					if (!req.file) throw new Error("Vui lòng chọn file Excel cần import");
					uploadedFilePath = req.file.path;

					// Validate file type
					const allowedMimes = [
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
						"application/vnd.ms-excel",
					];
					if (!allowedMimes.includes(req.file.mimetype)) {
						fs.unlinkSync(uploadedFilePath);
						throw new Error("Chỉ chấp nhận file Excel (.xlsx, .xls)");
					}

					// Parse Excel
					const questions = await parseExcelFile(uploadedFilePath);

					// Validate
					const validation = validateQuestions(questions);
					if (!validation.valid) {
						fs.unlinkSync(uploadedFilePath);
						const errorMessages = validation.errors.map(e => `Dòng ${e.row}: ${e.message}`).join("; ");
						throw new Error(errorMessages);
					}

					// Prepare data with created_by/updated_by and ObjectIds for answers
					const questionsToCreate = questions.map((q) => ({
						name: q.name,
						type: q.type,
						level: q.level,
						priority: q.priority,
						files: [],
						answers:
							q.type === QuestionTypes.ESSAY
								? []
								: q.answers.map((a) => ({
										_id: new mongoose.Types.ObjectId(),
										value: a.value,
										is_correct: a.is_correct,
									})),
						created_by: userId,
						updated_by: userId,
					}));

					// Bulk create
					const result = await provider.bulkCreate(questionsToCreate as any);

					// Cleanup file
					fs.unlinkSync(uploadedFilePath);

					return res.sendOk({
						data: { 
							total: questions.length, 
							imported: result.length,
							failed: questions.length - result.length,
							errors: []
						},
						message: `Import thành công ${result.length}/${questions.length} câu hỏi`,
					});
				} catch (error) {
					if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
						fs.unlinkSync(uploadedFilePath);
					}
					return res.sendError({ err: error });
				}
			},
		},
	};

	async function parseExcelFile(filePath: string): Promise<ParsedQuestion[]> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.readFile(filePath);
		const worksheet = workbook.getWorksheet(1);

		const questions: ParsedQuestion[] = [];

			// Expected columns: STT, Câu hỏi, Đáp án A, Đáp án B, Đáp án C, Đáp án D, Đáp án đúng, Loại, Độ khó
		worksheet.eachRow((row, rowNumber) => {	
			if (rowNumber === 1) return; // Skip header

			const cells = row.values as any[];
			const name = cells[2];
			const ansA = cells[3];
			const ansB = cells[4];
			const ansC = cells[5];
			const ansD = cells[6];
			const correctAns = cells[7];
			const type = cells[8];
			const level = cells[9];

			if (!name || !type) return;

			const typeUpper = type.toString().toUpperCase().trim();
			const isEssay = typeUpper === "ESSAY" || typeUpper === "TỰ LUẬN" || typeUpper === "TU Luan";
			const questionType = isEssay ? QuestionTypes.ESSAY : QuestionTypes.MULTIPLE_CHOICE;

			const answers: { value: string; is_correct: boolean }[] = [];
			if (questionType === QuestionTypes.MULTIPLE_CHOICE) {
				if (ansA) answers.push({ value: ansA.toString(), is_correct: correctAns?.toString().toUpperCase() === "A" });
				if (ansB) answers.push({ value: ansB.toString(), is_correct: correctAns?.toString().toUpperCase() === "B" });
				if (ansC) answers.push({ value: ansC.toString(), is_correct: correctAns?.toString().toUpperCase() === "C" });
				if (ansD) answers.push({ value: ansD.toString(), is_correct: correctAns?.toString().toUpperCase() === "D" });
			}

			questions.push({
				name: name.toString(),
				type: questionType,
				level: parseLevel(level),
				priority: 1,
				answers,
			});
		});

		return questions;
	}

	function parseLevel(level: any): string {
		if (!level) return DifficultyLevels.NORMAL;
		const levelStr = level.toString().toUpperCase();
		if (levelStr === "EASY" || levelStr === "DỄ") return DifficultyLevels.EASY;
		if (levelStr === "HARD" || levelStr === "KHÓ") return DifficultyLevels.HARD;
		return DifficultyLevels.NORMAL;
	}

	function validateQuestions(questions: ParsedQuestion[]): { valid: boolean; errors: { row: number; message: string }[] } {
		const errors: { row: number; message: string }[] = [];

		for (let i = 0; i < questions.length; i++) {
			const q = questions[i];
			const rowNum = i + 2;

			if (!q.name || q.name.trim().length === 0) {
				errors.push({ row: rowNum, message: "Tên câu hỏi trống" });
			}

			if (q.type === QuestionTypes.MULTIPLE_CHOICE) {
				if (q.answers.length < 2) {
					errors.push({ row: rowNum, message: "Thiếu đáp án" });
				}
				const correctCount = q.answers.filter((a) => a.is_correct).length;
				if (correctCount === 0) {
					errors.push({ row: rowNum, message: "Thiếu đáp án đúng" });
				}
				if (correctCount > 1) {
					errors.push({ row: rowNum, message: "Chỉ được chọn 1 đáp án đúng" });
				}
			}
		}

		return { valid: errors.length === 0, errors };
	}
};
