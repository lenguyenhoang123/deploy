import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { queryFilter } from "#middlewares/query-filter";
import mongoose from "mongoose";
import { ExcelExportService } from "#services/excelExportService";
import { participantStatisticsTemplate } from "#templates/excel/statisticsTemplate";
import { formattedDataToExport } from "#services/statisticsService";

export default (_express: Application) => {
	const provider = new ExamProvider();

	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin, queryFilter],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /statistics/exam/{exam_id}/participant/export:
				 *   get:
				 *     tags: [Statistics]
				 *     description: Get exam statistics by ID.
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
				 *       - name: filters
				 *         in: query
				 *         schema:
				 *           type: string
				 *         description: Optional filter criteria for the items.
				 *       - name: pageSize
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           example: 10
				 *         description: Number of items per page.
				 *       - name: currentPage
				 *         in: query
				 *         schema:
				 *           type: integer
				 *           example: 1
				 *         description: Current page number for pagination.
				 *       - name: sortBy
				 *         in: query
				 *         schema:
				 *           type: string
				 *           example: correct_count,desc;time_taken,asc
				 *         description: Sorting criteria (e.g., "correct_count,desc;time_taken,asc")
				 *         required: false
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
				 *             description: Excel file
				 */

				try {
					const examId = req.params.exam_id as string;
					if (!examId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("ID không hợp lệ");
					const queryOptions = {
						where: req.payload.where,
						pageSize: req.payload.pageSize,
						currentPage: req.payload.currentPage,
						sortBy: req.query.sortBy as string,
					};

					const result = await provider.getParticipantStatistics(examId, queryOptions);

					const formattedData = formattedDataToExport(result.rows);
					const excelBuffer = await ExcelExportService.generateExcel(
						formattedData,
						participantStatisticsTemplate.headers,
					);
					res.setHeader("Content-Disposition", "attachment; filename=ThongKeTheoCaNhan.xlsx");
					res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
					return res.send(excelBuffer);
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
