import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import mongoose from "mongoose";
import { queryFilter } from "#middlewares/query-filter";
import { UserProvider } from "#providers/userProvider";

export default (_express: Application) => {
	const provider = new ExamProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin, queryFilter],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/{exam_id}/participants-essay:
				 *   get:
				 *     tags: [Exam]
				 *     description: Get participants with essay grading status for an exam (Admin only)
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: exam_id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: Exam ID
				 *         required: true
				 *       - name: essay_status
				 *         in: query
				 *         schema:
				 *           type: string
				 *           enum: [all, graded, pending, partial]
				 *           default: all
				 *         description: Filter by essay grading status (all, graded=all essay graded, pending=all essay pending, partial=some graded)
				 *       - name: filters
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Optional filter criteria
				 *       - name: pageSize
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           example: 10
				 *         description: Number of items per page
				 *       - name: currentPage
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           example: 1
				 *         description: Current page number
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				try {
					await userProvider.validateUserId(req.user.id as string);
					const examId = req.params.exam_id as string;
					if (!examId) throw new Error("ID kỳ thi không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("ID kỳ thi không hợp lệ");

					const essayStatus = (req.query.essay_status as string) || "all";

					const queryOptions = {
						where: req.payload.where,
						pageSize: req.payload.pageSize,
						currentPage: req.payload.currentPage,
					};

					const result = await provider.getParticipantsWithEssayStatus(examId, queryOptions, essayStatus);

					return res.sendOk({
						data: result,
						message: "Lấy danh sách thí sinh với trạng thái chấm tự luận thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
