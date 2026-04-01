import ExcelJS from "exceljs";

export interface ExcelSheetData {
	sheetName: string;
	data: any[];
	headers: { header: string; key: string; width: number }[];
}

export class ExcelExportService {
	static async generateExcel(
		data: any[],
		headers: { header: string; key: string; width: number }[],
	): Promise<Buffer | any> {
		const workbook = new ExcelJS.Workbook();
		const worksheet = workbook.addWorksheet("Data");

		worksheet.columns = headers.map((header) => ({
			header: header.header,
			key: header.key,
			width: header.width,
		}));

		data.forEach((item) => {
			worksheet.addRow(item);
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
}
