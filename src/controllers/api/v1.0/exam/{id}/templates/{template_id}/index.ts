import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { QuestionBankProvider } from "#providers/questionBankProvider";
import mongoose from "mongoose";
import { UserProvider } from "#providers/userProvider";
import { QuestionTypes } from "#models/questionBank";

export default (_express: Application) => {
	const examProvider = new ExamProvider();
	const questionBankProvider = new QuestionBankProvider();
	const userProvider = new UserProvider();
	return <Resource>{
		put: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/{id}/templates/{template_id}:
				 *   put:
				 *     tags: [Exam]
				 *     description: Edit/Update a template (name, questions, or quantity)
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam ID
				 *         required: true
				 *       - name: template_id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 69ca4d16cc523335772b55ee
				 *         description: Template ID to edit
				 *         required: true
				 *     requestBody:
				 *       description: Edit Template Fields
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             properties:
				 *               name:
				 *                 type: string
				 *                 example: Đề 1 - Cập nhật
				 *                 description: Tên đề thi mới (optional)
				 *               quantity:
				 *                 type: integer
				 *                 example: 25
				 *                 description: Số lượng câu hỏi trắc nghiệm mới (optional, auto-random từ ngân hàng)
				 *               essay_quantity:
				 *                 type: integer
				 *                 example: 5
				 *                 description: Số lượng câu hỏi tự luận mới (optional, auto-random từ ngân hàng)
				 *               questions:
				 *                 type: array
				 *                 description: Danh sách ID câu hỏi cụ thể (optional, ưu tiên cao hơn quantity)
				 *                 items:
				 *                   type: string
				 *                   example: 6699f4391c7ab023b0a77b5c
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
					const examId = req.params.id as string;
					const templateId = req.params.template_id as string;

					if (!examId) throw new Error("ID kỳ thi không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("ID kỳ thi không hợp lệ");

					if (!templateId) throw new Error("ID đề thi không được để trống");
					if (!mongoose.Types.ObjectId.isValid(templateId)) throw new Error("ID đề thi không hợp lệ");

					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const exam = await examProvider.getById(examId);
					if (!exam) throw new Error("Kỳ thi không tồn tại");

					// Only allow edit before exam starts
					if (currentTime >= exam.start_time) {
						throw new Error("Không thể chỉnh sửa đề thi cho kỳ thi đã hoặc đang diễn ra");
					}

					// Find template index
					const templateIndex = exam.templates.findIndex((t: any) => t._id.toString() === templateId);
					if (templateIndex === -1) throw new Error("Không tìm thấy đề thi");

					const { name, questions, quantity, essay_quantity } = req.body;
					const updateFields: any = {};

					// Validate and update name if provided
					if (name !== undefined) {
						if (!name || name.trim() === "") {
							throw new Error("Tên đề thi không được để trống");
						}
						updateFields[`templates.${templateIndex}.name`] = name.trim();
					}

					// Handle questions update (priority: questions array > quantity/essay_quantity)
					if (questions !== undefined) {
						// Use specific question IDs provided
						if (!Array.isArray(questions) || questions.length === 0) {
							throw new Error("Danh sách câu hỏi không hợp lệ");
						}

						// Validate all question IDs
						const validQuestionIds: mongoose.Types.ObjectId[] = [];
						for (const questionId of questions) {
							if (!mongoose.Types.ObjectId.isValid(questionId)) {
								throw new Error(`ID câu hỏi không hợp lệ: ${questionId}`);
							}

							// Verify question exists in question bank
							const question = await questionBankProvider.getById(questionId);
							if (!question) {
								throw new Error(`Câu hỏi không tồn tại: ${questionId}`);
							}

							validQuestionIds.push(new mongoose.Types.ObjectId(questionId));
						}

						updateFields[`templates.${templateIndex}.questions`] = validQuestionIds;
					} else if (quantity !== undefined || essay_quantity !== undefined) {
						// Auto-fetch random questions from question bank
						const quantityNumber = quantity !== undefined ? parseInt(quantity as string, 10) : 0;
						const essayQuantityNumber = essay_quantity !== undefined ? parseInt(essay_quantity as string, 10) : 0;

						if (quantity !== undefined && (isNaN(quantityNumber) || quantityNumber < 0)) {
							throw new Error("Số lượng câu hỏi trắc nghiệm không hợp lệ");
						}

						if (essay_quantity !== undefined && (isNaN(essayQuantityNumber) || essayQuantityNumber < 0)) {
							throw new Error("Số lượng câu hỏi tự luận không hợp lệ");
						}

						if (quantityNumber === 0 && essayQuantityNumber === 0) {
							throw new Error("Tổng số lượng câu hỏi phải lớn hơn 0");
						}

						// Fetch random questions from question bank
						const multipleChoiceQuestions = quantityNumber > 0
							? await questionBankProvider.getRandomQuestionsByType(quantityNumber, QuestionTypes.MULTIPLE_CHOICE)
							: [];
						const essayQuestions = essayQuantityNumber > 0
							? await questionBankProvider.getRandomQuestionsByType(essayQuantityNumber, QuestionTypes.ESSAY)
							: [];

						const newQuestionIds = [
							...multipleChoiceQuestions.map((q: any) => q._id),
							...essayQuestions.map((q: any) => q._id),
						];

						updateFields[`templates.${templateIndex}.questions`] = newQuestionIds;
					}

					// If no fields to update
					if (Object.keys(updateFields).length === 0) {
						throw new Error("Không có thông tin nào để cập nhật");
					}

					// Add update metadata
					updateFields.updated_by = userId;
					updateFields.updated_at = currentTime;

					// Update the exam
					const data = await exam.updateOne({ $set: updateFields });
					if (data.modifiedCount <= 0) throw new Error("Cập nhật đề thi thất bại");

					return res.sendOk({
						data: { message: "Cập nhật đề thi thành công" },
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
