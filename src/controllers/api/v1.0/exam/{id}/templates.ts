import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { QuestionBankProvider } from "#providers/questionBankProvider";
import mongoose from "mongoose";

export default (_express: Application) => {
	const examProvider = new ExamProvider();
	const questionBankProvider = new QuestionBankProvider();
	return <Resource>{
		put: {
			middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/{id}/templates:
				 *   put:
				 *     tags: [Exam]
				 *     description: Add template to an exam
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam ID to add template
				 *         required: true
				 *     requestBody:
				 *       description: Add Tepmlate Fields
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             properties:
				 *               name:
				 *                 type: string
				 *                 example: Đề 1
				 *               quantity:
				 *                 type: integer
				 *                 example: 20
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					if (!req.user || !req.user.id) throw new Error("Lấy thông tin tài khoản thất bại!");

					const examId = req.params.id as string;
					if (!examId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("ID không hợp lệ");

					const exam = await examProvider.getById(examId);
					if (!exam) throw new Error("Kỳ thi không tồn tại");

					const { name, quantity } = req.body;

					const quantityNumber = parseInt(quantity as string, 10);
					if (isNaN(quantityNumber) || quantityNumber <= 0) {
						throw new Error("Số lượng câu hỏi không hợp lệ");
					}

					const newTemplate = {
						name: name,
						questions: await questionBankProvider.getRandomQuestions(quantityNumber),
					};

					const data = await exam.updateOne({ template: newTemplate, updated_by: req.user.id, updated_at: new Date() });
					if (data.modifiedCount <= 0) throw new Error("Tạo đề thi thất bại");
					return res.sendOk({ data: { message: "Tạo đề thi thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
