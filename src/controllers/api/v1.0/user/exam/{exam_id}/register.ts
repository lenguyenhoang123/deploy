import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { IExam } from "#models/exam";
import mongoose from "mongoose";
import { UserProvider } from "#providers/userProvider";

export default (_express: Application) => {
	const provider = new ExamProvider();
	const userProvider = new UserProvider();
	return <Resource>{
		put: {
			middleware: verify,
			handler: async (req: Req<IExam>, res: Res) => {
				/**
				 * @openapi
				 * /user/exam/{exam_id}/register:
				 *   put:
				 *     tags: [User]
				 *     description: Register an exam
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: exam_id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam ID to register
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
					const currentTime = new Date();
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);

					const examId = req.params.exam_id as string;
					const exam = await provider.validateAndFetchExam(examId);

					if (currentTime > exam.end_time) throw new Error("Kỳ thi đã hết hạn đăng ký");

					const participants = exam.participants;
					if (participants.find((p) => p.user_id.toString() === userId.toString()))
						throw new Error("Bạn đã đăng ký kỳ thi này trước đó");

					const data = await exam.updateOne({
						participants: [...participants, { user_id: userId }],
					});

					if (data.modifiedCount <= 0) throw new Error("Đăng ký thi thất bại");
					return res.sendOk({ data: { message: "Đăng ký thi thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
