import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { queryFilter } from "#middlewares/query-filter";
import mongoose from "mongoose";
import { participantStatisticsTemplate } from "#templates/excel/statisticsTemplate";
import { formattedParticipantDataToExport, classifyStudentLevel } from "#services/statisticsService";
import { UserProvider } from "#providers/userProvider";
import { ExcelExportService } from "#services/excelExportService";


export default (_express: Application) => {
	const provider = new ExamProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin, queryFilter],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /statistics/exam/{exam_id}/participant/export:
				 *   get:
				 *     tags: [Statistics]
				 *     description: Export exam statistics to Excel with THCS and THPT sheets.
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
				 *         description: Optional filter criteria.
				 *       - name: sortBy
				 *         in: query
				 *         schema:
				 *           type: string
				 *           example: best_score,desc;best_time_taken,asc
				 *         description: Sorting criteria.
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
				 *             description: Excel file with THCS and THPT sheets
				 */

				try {
					await userProvider.validateUserId(req.user.id as string);
					const examId = req.params.exam_id as string;
					if (!examId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("ID không hợp lệ");

					// Get all participants (no pagination for export)
					const queryOptions = {
						where: req.payload.where,
						sortBy: req.query.sortBy as string,
					};

					const result = await provider.getParticipantStatistics(examId, {
						...queryOptions,
						pageSize: 0,
						currentPage: 1,
					});

					// Split data into THCS and THPT
					const thcsData: any[] = [];
					const thptData: any[] = [];

					for (const item of result.rows) {
						const level = classifyStudentLevel(item.class_name);
						if (level === "THCS") {
							thcsData.push(item);
						} else if (level === "THPT") {
							thptData.push(item);
						}
					}

					// Format data for export
					const formattedTHCS = formattedParticipantDataToExport(thcsData);
					const formattedTHPT = formattedParticipantDataToExport(thptData);

					// Generate styled multi-sheet Excel
					const configs = [];
					if (formattedTHCS.length > 0) {
						configs.push({
							sheetName: "THCS",
							title: "THỐNG KÊ CÁ NHÂN - THCS",
							titleBgColor: "1F6FEB",
							data: formattedTHCS,
							headers: participantStatisticsTemplate.headers,
							highlightTop3: true,
						});
					}
					if (formattedTHPT.length > 0) {
						configs.push({
							sheetName: "THPT",
							title: "THỐNG KÊ CÁ NHÂN - THPT",
							titleBgColor: "9333EA",
							data: formattedTHPT,
							headers: participantStatisticsTemplate.headers,
							highlightTop3: true,
						});
					}
					const excelBuffer = await ExcelExportService.generateStyledMultiSheet(configs);
					const timestamp = new Date().toISOString().split("T")[0];
					res.setHeader("Content-Disposition", `attachment; filename="ThongKeTheoCaNhan_${timestamp}.xlsx"`);
					res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
					return res.send(excelBuffer);
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
