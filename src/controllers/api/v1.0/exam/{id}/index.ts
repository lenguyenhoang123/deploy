import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import mongoose from "mongoose";
import { IExam } from "#models/exam";
import { validateExamEntry } from "#middlewares/validator";
import { UserProvider } from "#providers/userProvider";

type ExamCreate = Omit<IExam, "created_at" | "created_by" | "updated_at" | "updated_by">;

export default (_express: Application) => {
	const provider = new ExamProvider();
	const userProvider = new UserProvider();
	return <Resource>{
		get: {
			middleware: verify,
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/{id}:
				 *   get:
				 *     tags: [Exam]
				 *     description: Get exam by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: ID
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
					const examId = req.params.id as string;
					if (!examId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("ID không hợp lệ");
					await userProvider.validateUserId(req.user.id as string);

					const exam = await provider.getById(examId, {
						attributes: [
							"name",
							"description",
							"start_time",
							"end_time",
							"allowed_time",
							"template",
							"participants",
							"created_by",
							"updated_by",
							"created_at",
							"updated_at",
						],
					});
					if (!exam) throw new Error("Kỳ thi không tồn tại");

					return res.sendOk({
						data: exam,
						message: "Lấy thông tin kỳ thi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		put: {
			middleware: [verify, verifyAdmin, validateExamEntry],
			handler: async (req: Req<IExam, ExamCreate>, res: Res) => {
				/**
				 * @openapi
				 * /exam/{id}:
				 *   put:
				 *     tags: [Exam]
				 *     description: Update an exam by ID
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: ID
				 *         required: true
				 *     requestBody:
				 *       description: Update Exam Fields
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             $ref: '#/components/schemas/ExamMutate'
				 *           example:
				 *             {
				 *               "name": "Kỳ thi tháng 08/2024",
				 *               "description": "Kỳ thi đánh giá kiến thức cơ bản tháng 08/2024",
				 *               "start_time": "2024-08-01T09:00:00Z",
				 *               "end_time": "2024-08-31T09:00:00Z",
				 *               "allowed_time": 120,
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
					const currentTime = new Date();

					const examId = req.params.id as string;
					if (!examId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("ID không hợp lệ");

					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const exam = await provider.getById(examId, {
						attributes: ["name", "description", "start_time", "end_time", "allowed_time", "updated_by", "updated_at"],
					});
					if (!exam) throw new Error("Kỳ thi không tồn tại");

					if (currentTime >= exam.start_time) throw new Error("Không thể chỉnh sửa kỳ thi đã hoặc đang diễn ra");

					const updatedExam = req.body;
					const data = await exam.updateOne({
						name: updatedExam.name,
						description: updatedExam.description,
						start_time: updatedExam.start_time,
						end_time: updatedExam.end_time,
						allowed_time: updatedExam.allowed_time,
						updated_by: userId,
						updated_at: currentTime,
					});

					if (data.modifiedCount <= 0) throw new Error("Có lỗi xảy ra khi cập nhật kỳ thi");
					return res.sendOk({ data: { message: "Cập nhật kỳ thi thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		delete: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/{id}:
				 *   delete:
				 *     tags: [Exam]
				 *     description: Delete exam by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: ID to delete
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
					const deleteId = req.params.id as string;
					if (!deleteId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(deleteId)) throw new Error("ID không hợp lệ");

					await userProvider.validateUserId(req.user.id as string);
					const existingItem = await provider.getById(deleteId);
					if (!existingItem) throw new Error("Kỳ thi không tồn tại");

					return res.sendOk({
						data: await provider.delete(deleteId),
						message: "Xóa kỳ thi thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
