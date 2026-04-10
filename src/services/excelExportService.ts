import ExcelJS from "exceljs";

export interface ExcelSheetData {
	sheetName: string;
	data: any[];
	headers: { header: string; key: string; width: number }[];
}

export interface StyledSheetConfig {
	sheetName: string;
	title: string;
	titleBgColor?: string; // argb format, default: 4472C4
	data: any[];
	headers: { header: string; key: string; width: number }[];
	highlightTop3?: boolean;
	badgeColumn?: string; // column key for badge styling (e.g., 'school_type', 'type')
}

export class ExcelExportService {
	static async generateExcel(
		data: any[],
		headers: { header: string; key: string; width: number }[],
		highlightField?: string, // field to check for highlighting (e.g., 'is_top')
	): Promise<Buffer | any> {
		const workbook = new ExcelJS.Workbook();
		const worksheet = workbook.addWorksheet("Data");

		worksheet.columns = headers.map((header) => ({
			header: header.header,
			key: header.key,
			width: header.width,
		}));

		data.forEach((item) => {
			const row = worksheet.addRow(item);
			
			// Highlight top rows with yellow background
			if (highlightField && item[highlightField] === true) {
				row.eachCell((cell) => {
					cell.fill = {
						type: 'pattern',
						pattern: 'solid',
						fgColor: { argb: 'FFFF00' }, // Yellow
					};
				});
			}
		});

		const buffer = await workbook.xlsx.writeBuffer();
		return buffer;
	}

	static async generateExcelMultiSheet(sheets: ExcelSheetData[]): Promise<Buffer | any> {
		const workbook = new ExcelJS.Workbook();

		for (const sheet of sheets) {
			const worksheet = workbook.addWorksheet(sheet.sheetName);

			worksheet.columns = sheet.headers.map((header) => ({
				header: header.header,
				key: header.key,
				width: header.width,
			}));

			sheet.data.forEach((item) => {
				worksheet.addRow(item);
			});
		}

		const buffer = await workbook.xlsx.writeBuffer();
		return buffer;
	}

	// ===== STYLED EXPORTS =====

	static async generateStyledSheet(config: StyledSheetConfig): Promise<ExcelJS.Workbook> {
		const workbook = new ExcelJS.Workbook();
		return this.addStyledSheet(workbook, config);
	}

	static addStyledSheet(workbook: ExcelJS.Workbook, config: StyledSheetConfig): ExcelJS.Workbook {
		const worksheet = workbook.addWorksheet(config.sheetName);
		const headers = config.headers;
		const data = config.data;
		const titleColor = config.titleBgColor || "4472C4";

		// ===== TITLE (optional) =====
		let rowOffset = 0;
		if (config.title) {
			const titleRow = worksheet.addRow([config.title]);
			titleRow.font = { bold: true, size: 16, name: "Segoe UI", color: { argb: "FFFFFF" } };
			titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: titleColor } };
			titleRow.alignment = { horizontal: "center", vertical: "middle" };
			worksheet.mergeCells(`A1:${String.fromCharCode(64 + headers.length)}1`);
			worksheet.getRow(1).height = 30;
			worksheet.addRow([]);
			rowOffset = 2;
		}

		// ===== COLUMNS (no auto header) =====
		worksheet.columns = headers.map(h => ({
			key: h.key,
			width: h.width,
		}));

		// ===== HEADER =====
		const headerRowIndex = rowOffset + 1;
		const headerRow = worksheet.getRow(headerRowIndex);
		headers.forEach((h, i) => {
			headerRow.getCell(i + 1).value = h.header;
		});
		headerRow.font = { bold: true, size: 11, color: { argb: "FFFFFF" }, name: "Segoe UI" };
		headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } };
		headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
		headerRow.height = 25;

		// Border for header
		headerRow.eachCell(cell => {
			cell.border = { bottom: { style: "thin", color: { argb: "2E5A8C" } } };
		});

		// ===== DATA =====
		data.forEach((item, index) => {
			const row = worksheet.addRow(item);

			// Highlight top 3
			if (config.highlightTop3 && index < 3) {
				row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2CC" } };
			}

			row.eachCell((cell, colNumber) => {
				cell.font = { name: "Segoe UI", size: 10 };
				cell.border = { bottom: { style: "thin", color: { argb: "EEEEEE" } } };

				// STT center (first column)
				if (colNumber === 1) {
					cell.alignment = { horizontal: "center", vertical: "middle" };
				} else {
					cell.alignment = { vertical: "middle", wrapText: true };
				}
			});

			// Badge styling
			if (config.badgeColumn) {
				const badgeCell = row.getCell(config.badgeColumn);
				const value = badgeCell.value?.toString();
				if (value === "THCS" || value === "Trắc nghiệm") {
					badgeCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E7F3FF" } };
					badgeCell.font = { color: { argb: "1F6FEB" }, bold: true, name: "Segoe UI" };
				} else if (value === "THPT" || value === "Tự luận") {
					badgeCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F3E8FF" } };
					badgeCell.font = { color: { argb: "9333EA" }, bold: true, name: "Segoe UI" };
				}
			}

			row.height = 25;
		});

		// ===== FREEZE + FILTER =====
		worksheet.views = [{ state: "frozen", ySplit: headerRowIndex + 1 }];
		worksheet.autoFilter = {
			from: { row: headerRowIndex, column: 1 },
			to: { row: headerRowIndex, column: headers.length },
		};

		return workbook;
	}

	static async generateStyledMultiSheet(configs: StyledSheetConfig[]): Promise<Buffer> {
		const workbook = new ExcelJS.Workbook();

		for (const config of configs) {
			this.addStyledSheet(workbook, config);
		}

		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer);
	}
}
