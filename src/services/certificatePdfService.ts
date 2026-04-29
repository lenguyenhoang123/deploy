import puppeteer, { Browser } from "puppeteer";
import fs from "fs";
import path from "path";
import { ICertificate } from "#models/certificate";
import { ICertificateTemplate } from "#models/certificateTemplate";
import { FileProvider } from "#providers/fileProvider";
import nconf from "nconf";

export class CertificatePdfService {
	private browser: Browser | null = null;

	async init() {
		if (!this.browser) {
			this.browser = await puppeteer.launch({
				headless: true,
				args: ["--no-sandbox", "--disable-setuid-sandbox"],
			});
		}
	}

	async close() {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}
	}

	async generateCertificatePdf(
		certificate: ICertificate,
		template: ICertificateTemplate,
		outputPath: string
	): Promise<string> {
		await this.init();

		if (!this.browser) {
			throw new Error("Browser not initialized");
		}

		const page = await this.browser.newPage();

		try {
			// Build HTML content with template design
			const html = await this.buildCertificateHtml(certificate, template);

			// Set content and wait for fonts/images to load
			await page.setContent(html, { waitUntil: "networkidle0" });

			// Generate PDF
			await page.pdf({
				path: outputPath,
				width: "1123px", // A4 landscape width
				height: "794px",  // A4 landscape height
				printBackground: true,
				preferCSSPageSize: false,
			});

			return outputPath;
		} finally {
			await page.close();	
		}	
	}

	private async buildCertificateHtml(certificate: ICertificate, template: ICertificateTemplate): Promise<string> {
		const design = template.design;
		const layout = design.layout;
		const content = design.content;
		const fileProvider = new FileProvider();
		const projectRoot = path.resolve(process.cwd());
		const storageRoot = path.resolve(nconf.get("Storage") || "./storage");

		// Helper to get base64 data from file ID
		const getFileBase64 = async (fileId: string | undefined, label: string): Promise<string> => {
			if (!fileId) {
				return "";
			}
			try {
				const file = await fileProvider.getById(fileId);
				if (file && file.file_path) {
					// file_path starts with /images/ or /certificates/ - use project root
					const absolutePath = path.join(projectRoot, file.file_path.replace(/^\//, ""));
					const exists = fs.existsSync(absolutePath);
					if (exists) {
						const ext = path.extname(file.file_path).toLowerCase();
						const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
						const imageBuffer = fs.readFileSync(absolutePath);
						const base64 = imageBuffer.toString('base64');
						return `data:${mimeType};base64,${base64}`;
					} else {
						return "";
					}
				} else {
					return "";
				}
			} catch (error) {
				return "";
			}
		};

		// Get base64 data for images
		const logoBase64 = await getFileBase64(design.logo?.toString(), "Logo");
		const bgBase64 = await getFileBase64(design.background?.toString(), "Background");

		// Signatures HTML with base64
		const signaturesHtml = await Promise.all(
			(design.signatures || []).map(async (sig, index) => {
				const sigBase64 = await getFileBase64(sig.signature_image?.toString(), `Signature ${index + 1} (${sig.name})`);
				const position = sig.position || "center";
				return `
					<div class="signature signature-${position}">
						<div class="signature-name">${sig.name}</div>
						<div class="signature-title">${sig.title}</div>
						<div class="signature-line"></div>
						${sigBase64 ? `<img src="${sigBase64}" class="signature-img" alt="" />` : ''}
					</div>
				`;
			})
		).then(htmls => htmls.join(""));

return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
	width:1123px;height:794px;
	font-family:'Times New Roman',serif;
	background:${bgBase64 ? `url(${bgBase64})` : "#fdfdfd"};
	background-size:cover;position:relative
}
.certificate{
	width:100%;height:100%;
	padding:25px 40px;
	display:flex;
	flex-direction:column;
	justify-content:space-between;
	align-items:center;
	gap:10px;
	position:relative;text-align:center
}
.certificate::before{
	content:"";
	position:absolute;top:15px;left:15px;right:15px;bottom:15px;
	border:3px solid ${layout.primary_color || "#c9a227"}
}
.certificate::after{
	content:"";
	position:absolute;top:22px;left:22px;right:22px;bottom:22px;
	border:1px solid #ddd
}
.logo{width:90px;margin-bottom:10px}
.title{
	font-size:48px;font-weight:bold;
	color:${layout.primary_color || "#c9a227"};
	letter-spacing:3px;margin-bottom:8px
}
.subtitle{
	font-size:22px;color:#666;
	margin-bottom:20px
}
.name{
	font-size:64px;font-weight:bold;
	color:#2c3e50;margin:20px 0;
	display:inline-block;
	border-bottom:3px solid ${layout.primary_color || "#c9a227"};
	padding-bottom:5px
}
.details{
	font-size:20px;color:#444;
	line-height:1.8;margin-top:10px
}
.seal{
	position:absolute;top:70px;right:70px;
	width:85px;height:85px;
	border:2px solid ${layout.primary_color || "#c9a227"};
	border-radius:50%;
	display:flex;align-items:center;justify-content:center;
	font-size:12px;color:${layout.primary_color || "#c9a227"}
}
.content{
	flex:1;
	display:flex;
	flex-direction:column;
	justify-content:center
}
.signatures{
	display:flex;
	justify-content:space-around;
	width:100%;
	padding:0 70px;
	margin-top:20px;
}
.signature{
	text-align:center;position:relative;
	min-width:200px
}
.signature-name{font-weight:bold;font-size:18px}
.signature-title{
	font-size:16px;color:#666;
	margin-bottom:20px
}
.signature-line{
	width:160px;height:1px;
	background:#333;margin:20px auto 0
}
.signature-img{
	height:50px;margin-top:10px;
	object-fit:contain;opacity:0.95
}
.footer{
	width:100%;display:flex;
	justify-content:space-between;
	padding:0 40px;font-size:13px;
	color:#777;margin-top:10px;
}
</style>
</head>
<body>
<div class="certificate">
	<div class="content">
		${logoBase64 ? `<img src="${logoBase64}" class="logo"/>` : ""}
		<div class="title">${design.title || "CERTIFICATE"}</div>
		<div class="subtitle">${design.subtitle || "OF ACHIEVEMENT"}</div>
		<p style="margin:10px 0;font-size:20px;color:#555">Chứng nhận rằng</p>
		<div class="name">${certificate.user_info.full_name}</div>
		<div class="details">
			${content.show_exam_name !== false ? `đã hoàn thành kỳ thi <strong>${certificate.exam_info.name}</strong><br>` : ""}
			${content.show_score !== false ? `với số điểm <strong>${certificate.exam_info.score}</strong><br>` : ""}
			${content.show_completion_date !== false ? `vào ngày <strong>${new Date(certificate.exam_info.completion_date || Date.now()).toLocaleDateString("vi-VN")}</strong>` : ""}
		</div>
		<div class="seal">VERIFIED</div>
	</div>
	<div class="signatures">${signaturesHtml}</div>
	<div class="footer">
		<div>Mã: ${certificate.certificate_code}</div>
		<div>${template.legal_text || ""}</div>
	</div>
</div>
</body>
</html>
`;
	}
}

export default new CertificatePdfService();
