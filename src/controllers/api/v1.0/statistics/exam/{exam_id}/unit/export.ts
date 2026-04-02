import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamProvider } from "#providers/examProvider";
import { queryFilter } from "#middlewares/query-filter";
import mongoose from "mongoose";
import { ExcelExportService } from "#services/excelExportService";
import { unitStatisticsTemplate } from "#templates/excel/statisticsTemplate";
import { UserProvider } from "#providers/userProvider";

// Format time in minutes to MM:SS or HH:MM:SS
function formatTimeMinutes(minutes: number): string {
	if (!minutes || minutes === 0) return "0:00";
	const hours = Math.floor(minutes / 60);
	const mins = Math.floor(minutes % 60);
	const secs = Math.floor((minutes * 60) % 60);
	if (hours > 0) {
		return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Format unit data for Excel export
function formatUnitDataToExport(array: any[]): any[] {
	return array.map((item, index) => ({
		...item,
		index: index + 1,
		// Round to 2 decimal places
		avg_correct_count: item.avg_correct_count ? Number(item.avg_correct_count.toFixed(2)) : 0,
		avg_time_taken: item.avg_time_taken ? Number(item.avg_time_taken.toFixed(2)) : 0,
		// Format time
		formatted_time_taken: formatTimeMinutes(item.time_taken || 0),
		// Ensure school_type has value
		school_type: item.school_type || "Khác",
		// Keep is_top for conditional formatting
		is_top: item.is_top || false,
	}));
}

export default (_express: Application) => {
	const provider = new ExamProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		get: {
			middleware: [verify, verifyAdmin, queryFilter],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /statistics/exam/{exam_id}/unit/export:
				 *   get:
				 *     tags: [Statistics]
				 *     description: Export exam unit statistics to Excel with highlight top 3.
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
				 *       - name: school_type
				 *         in: query
				 *         schema:
				 *           type: string
				 *           enum: [THCS, THPT]
				 *           example: THPT
				 *         description: Filter by school type (THCS or THPT)
				 *       - name: sortBy
				 *         in: query
				 *         schema:
				 *           type: string
				 *           example: rank,asc
				 *         description: Sorting criteria.
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
				 *             description: Excel file with unit statistics (top 3 highlighted in yellow)
				 */

				try {
					await userProvider.validateUserId(req.user.id as string);
					const examId = req.params.exam_id as string;
					if (!examId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) throw new Error("ID không hợp lệ");

					// Lấy filter school_type từ query (THCS hoặc THPT)
					const schoolTypeFilter = req.query.school_type as string;

					const queryOptions = {
						where: req.payload.where,
						pageSize: req.payload.pageSize,
						currentPage: req.payload.currentPage,
						sortBy: req.query.sortBy as string,
					};

					const result = await provider.getUnitStatistics(examId, queryOptions);

					// Format dữ liệu
					let formattedData = formatUnitDataToExport(result.rows);

					// Filter theo school_type nếu có
					if (schoolTypeFilter) {
						formattedData = formattedData.filter(
							(item) => item.school_type === schoolTypeFilter
						);
					}

					// Generate Excel với highlight top 3 (is_top = true)
					const excelBuffer = await ExcelExportService.generateExcel(
						formattedData,
						unitStatisticsTemplate.headers,
						'is_top' // truyền field để highlight
					);
					res.setHeader("Content-Disposition", "attachment; filename=ThongKeTheoDonVi.xlsx");
					res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
					return res.send(excelBuffer);
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
