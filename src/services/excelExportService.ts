import ExcelJS from "exceljs";

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
}
