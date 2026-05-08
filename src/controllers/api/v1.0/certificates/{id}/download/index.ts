import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { CertificateProvider } from "#providers/certificateProvider";
import { LearningQuizAttemptProvider } from "#providers/learningQuizAttemptProvider";
import { CertificateTemplateProvider } from "#providers/certificateTemplateProvider";
import { LearningQuizProvider } from "#providers/learningQuizProvider";
import certificatePdfService from "#services/certificatePdfService";
import puppeteer from "puppeteer";
import { ObjectId } from "mongodb";
import fs from "fs";
import path from "path";
import nconf from "nconf";
import { v4 as uuidv4 } from "uuid";
import { Types } from "mongoose";

// Helper function to generate certificate PDF (copied from learning certificate API)
async function generateCertificatePDF(data: {
	userName: string;
	courseTitle: string;
	completionDate: Date;
	score: number;
	attemptId: string;
	template: any;
}): Promise<Buffer> {
	let html: string;

	if (data.template && data.template.design) {
		// Use template from DB
		const design = data.template.design;
		const conditions = data.template.conditions || {};
		
		html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<style>
				body { 
					font-family: '${design.layout?.font_family || 'Times New Roman'}', serif; 
					margin: 0; 
					padding: 0;
					background: #f5f5f5;
				}
				.certificate {
					width: 800px;
					height: 600px;
					margin: 50px auto;
					background: white;
					border: 10px solid ${design.layout?.primary_color || '#2c3e50'};
					padding: 40px;
					text-align: center;
					position: relative;
					box-shadow: 0 4px 8px rgba(0,0,0,0.1);
				}
				.certificate-content {
					position: relative;
					z-index: 2;
				}
				.certificate h1 {
					color: ${design.layout?.primary_color || '#2c3e50'};
					font-size: 36px;
					margin-bottom: 10px;
					font-weight: bold;
				}
				.certificate h2 {
					color: ${design.layout?.secondary_color || '#34495e'};
					font-size: 24px;
					margin-bottom: 30px;
				}
				.certificate p {
					color: ${design.layout?.text_color || '#2c3e50'};
					font-size: 18px;
					margin: 10px 0;
					line-height: 1.6;
				}
				.certificate .recipient {
					font-size: 28px;
					font-weight: bold;
					color: ${design.layout?.primary_color || '#2c3e50'};
					margin: 20px 0;
					border-bottom: 2px solid ${design.layout?.primary_color || '#2c3e50'};
					padding-bottom: 10px;
				}
				.certificate .score {
					font-size: 20px;
					font-weight: bold;
					color: ${design.layout?.accent_color || '#e74c3c'};
					margin: 15px 0;
				}
				.certificate .date {
					font-size: 16px;
					color: ${design.layout?.text_color || '#2c3e50'};
					margin-top: 30px;
				}
				.certificate .signatures {
					display: flex;
					justify-content: space-between;
					margin-top: 40px;
				}
				.certificate .signature {
					text-align: center;
					width: 45%;
				}
				.certificate .signature-line {
					border-top: 1px solid ${design.layout?.text_color || '#2c3e50'};
					margin-top: 40px;
					padding-top: 5px;
					font-size: 14px;
					color: ${design.layout?.text_color || '#2c3e50'};
				}
				.certificate .background {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background: url('${design.background?.image_url || ''}') no-repeat center center;
					background-size: cover;
					opacity: ${design.background?.opacity || 0.1};
					z-index: 1;
				}
				.certificate .border-pattern {
					position: absolute;
					top: 10px;
					left: 10px;
					right: 10px;
					bottom: 10px;
					border: 2px solid ${design.border?.color || '#d4af37'};
					z-index: 1;
				}
				.certificate .seal {
					position: absolute;
					bottom: 20px;
					right: 20px;
					width: 80px;
					height: 80px;
					background: ${design.seal?.color || '#d4af37'};
					border-radius: 50%;
					display: flex;
					align-items: center;
					justify-content: center;
					color: white;
					font-weight: bold;
					font-size: 12px;
					z-index: 3;
				}
			</style>
		</head>
		<body>
			<div class="certificate">
				${design.background?.image_url ? '<div class="background"></div>' : ''}
				${design.border?.style === 'pattern' ? '<div class="border-pattern"></div>' : ''}
				
				<div class="certificate-content">
					<h1>${design.content?.title || 'CHỨNG CHỈ'}</h1>
					<h2>${design.content?.subtitle || 'Hoàn thành khóa học'}</h2>
					
					<p>Cấp cho:</p>
					<div class="recipient">${data.userName}</div>
					
					<p>Đã hoàn thành thành công:</p>
					<p><strong>${data.courseTitle}</strong></p>
					
					<div class="score">
						Điểm số: ${data.score}%
					</div>
					
					<div class="date">
						Ngày cấp: ${data.completionDate.toLocaleDateString('vi-VN')}
					</div>
					
					${design.signatures && design.signatures.length > 0 ? `
					<div class="signatures">
						${design.signatures.map((sig: any, index: number) => `
							<div class="signature">
								<div class="signature-line">${sig.name || ''}</div>
							</div>
						`).join('')}
					</div>
					` : ''}
					
					${design.seal?.show ? '<div class="seal">ĐÃNG BẢO</div>' : ''}
				</div>
			</div>
		</body>
		</html>`;
	} else {
		// Fallback to hardcoded HTML
		html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<style>
				body { font-family: 'Times New Roman', serif; margin: 0; padding: 0; background: #f5f5f5; }
				.certificate { width: 800px; height: 600px; margin: 50px auto; background: white; border: 10px solid #2c3e50; padding: 40px; text-align: center; position: relative; }
				.certificate h1 { color: #2c3e50; font-size: 36px; margin-bottom: 10px; font-weight: bold; }
				.certificate h2 { color: #34495e; font-size: 24px; margin-bottom: 30px; }
				.certificate p { color: #2c3e50; font-size: 18px; margin: 10px 0; line-height: 1.6; }
				.certificate .recipient { font-size: 28px; font-weight: bold; color: #2c3e50; margin: 20px 0; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; }
				.certificate .score { font-size: 20px; font-weight: bold; color: #e74c3c; margin: 15px 0; }
				.certificate .date { font-size: 16px; color: #2c3e50; margin-top: 30px; }
			</style>
		</head>
		<body>
			<div class="certificate">
				<h1>CHỨNG CHỈ</h1>
				<h2>Hoàn thành khóa học</h2>
				<p>Cấp cho:</p>
				<div class="recipient">${data.userName}</div>
				<p>Đã hoàn thành thành công:</p>
				<p><strong>${data.courseTitle}</strong></p>
				<div class="score">Điểm số: ${data.score}%</div>
				<div class="date">Ngày cấp: ${data.completionDate.toLocaleDateString('vi-VN')}</div>
			</div>
		</body>
		</html>`;
	}

	const browser = await puppeteer.launch({
		headless: true,
		args: ['--no-sandbox', '--disable-setuid-sandbox']
	});

	const page = await browser.newPage();
	await page.setContent(html, { waitUntil: 'networkidle0' });

	const pdfBuffer = await page.pdf({
		format: 'A4',
		printBackground: true,
		margin: {
			top: '20px',
			right: '20px',
			bottom: '20px',
			left: '20px'
		}
	});

	await browser.close();
	return pdfBuffer as any;
}

export default (_express: Application) => {
	const certificateProvider = new CertificateProvider();
	const attemptProvider = new LearningQuizAttemptProvider();
	const templateProvider = new CertificateTemplateProvider();
	const quizProvider = new LearningQuizProvider();

	return <Resource>{
		get: {
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /certificates/{id}/download:
				 *   get:
				 *     tags: [Certificate]
				 *     description: Download certificate PDF (works for both exam and learning certificates)
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         required: true
				 *         schema:
				 *           type: string
				 *         description: Certificate ID (can be exam certificate ID or learning quiz attempt ID)
				 *     responses:
				 *       200:
				 *         description: PDF file
				 *         content:
				 *           application/pdf:
				 *             schema:
				 *               type: string
				 *               format: binary
				 *       404:
				 *         description: Certificate not found
				 */
				try {
					const certificateId = req.params.id;
					const userId = req.user.id as string;

					// Try to find certificate by ID first
					let certificate = await certificateProvider.getById(certificateId);

					if (certificate) {
						// Found certificate by ID - check ownership
						if (certificate.user_id.toString() !== userId) {
							return res.sendError({ err: new Error("Bạn không có quyền tải chứng chỉ này") });
						}

						// If certificate already has PDF file, serve it directly
						if (certificate.file_url) {
							const storageRoot = path.resolve(nconf.get("Storage") || "./storage");
							const pdfPath = path.join(storageRoot, certificate.file_url.replace(/^\//, ""));
							
							if (fs.existsSync(pdfPath)) {
								const pdfBuffer = fs.readFileSync(pdfPath);
								res.setHeader('Content-Type', 'application/pdf');
								res.setHeader('Content-Disposition', `attachment; filename="certificate_${certificate.certificate_code || certificateId}.pdf"`);
								res.send(pdfBuffer);
								return;
							}
						}

						// Certificate does not have PDF file yet
						return res.sendError({ err: new Error("Chứng chỉ chưa có file PDF. Vui lòng liên hệ admin để tạo lại chứng chỉ.") });
					}

					// If not found by ID, try as learning quiz attempt ID
					const attempt = await attemptProvider.getAttemptById(certificateId);
					
					if (!attempt) {
						return res.sendError({ err: new Error("Không tìm thấy chứng chỉ hoặc bài ôn tập") });
					}

					// Check if user owns this attempt
					if (attempt.user_id.toString() !== userId) {
						return res.sendError({ err: new Error("Bạn không có quyền truy cập bài ôn tập này") });
					}

					// Check if attempt is completed and passed
					if (attempt.status !== "completed" || !attempt.passed) {
						return res.sendError({ err: new Error("Bài ôn tập chưa hoàn thành hoặc chưa đạt yêu cầu") });
					}

					// Get quiz info for min score check
					const quiz = await quizProvider.getById(attempt.quiz_id.toString());
					if (!quiz || !quiz.content_id) {
						return res.sendError({ err: new Error("Không tìm thấy thông tin quiz") });
					}

					// Get template to determine min score requirement
					let template = null;
					if (quiz && quiz.content_id) {
						template = await templateProvider.getByContentId(quiz.content_id.toString());
						if (!template) {
							template = await templateProvider.getGlobalTemplate("learning_quiz");
						}
					}
					const minScore = template?.conditions?.min_score ?? quiz?.passing_score ?? 80;

					// Check if score meets min score requirement
					if ((attempt.score || 0) < minScore) {
						return res.sendError({ 
							err: new Error(`Bạn cần đạt ít nhất ${minScore}% để nhận chứng chỉ. Hiện tại: ${attempt.score}%`) 
						});
					}

					// Check if certificate already exists for this attempt
					const existingCert = await certificateProvider.getByQuizAttemptId(certificateId);
					if (existingCert) {
						// Return existing certificate
						const pdfBuffer = await generateCertificatePDF({
							userName: `${(req.user as any).last_name || ""} ${(req.user as any).middle_name || ""} ${(req.user as any).first_name || ""}`.trim(),
							courseTitle: existingCert.exam_info?.name || "Chứng chỉ",
							completionDate: existingCert.exam_info?.completion_date || new Date(),
							score: existingCert.exam_info?.score || 0,
							attemptId: certificateId,
							template: null // Use default template
						});
						
						res.setHeader('Content-Type', 'application/pdf');
						res.setHeader('Content-Disposition', `attachment; filename="certificate_${existingCert.certificate_code || certificateId}.pdf"`);
						res.send(pdfBuffer);
						return;
					}

					// Create new certificate for learning quiz
					const certTemplate = template || await templateProvider.getGlobalTemplate("learning_quiz");
					if (!certTemplate) {
						return res.sendError({ err: new Error("Không có template chứng chỉ") });
					}

					const newCertificate = await certificateProvider.createCertificate({
						type: "learning_quiz",
						user_id: new ObjectId(userId),
						quiz_attempt_id: new ObjectId(certificateId),
						content_id: new ObjectId(quiz.content_id.toString()),
						quiz_id: new ObjectId(attempt.quiz_id.toString()),
						template_id: new ObjectId(certTemplate._id.toString()),
						user_info: {
							full_name: `${(req.user as any).last_name || ""} ${(req.user as any).middle_name || ""} ${(req.user as any).first_name || ""}`.trim(),
							identity_number: (req.user as any).profile?.identity_number,
							class_name: (req.user as any).profile?.class_name,
							school_name: (req.user as any).profile?.school_name,
						},
						exam_info: {
							name: quiz.title || "Bài ôn tập",
							completion_date: attempt.end_time || new Date(),
							score: attempt.score || 0
						},
						status: "active"
					});

					// Generate and return PDF
					const pdfBuffer = await generateCertificatePDF({
						userName: `${(req.user as any).last_name || ""} ${(req.user as any).middle_name || ""} ${(req.user as any).first_name || ""}`.trim(),
						courseTitle: newCertificate.exam_info?.name || "Bài ôn tập",
						completionDate: newCertificate.exam_info?.completion_date || new Date(),
						score: newCertificate.exam_info?.score || 0,
						attemptId: certificateId,
						template: certTemplate
					});
					
					res.setHeader('Content-Type', 'application/pdf');
					res.setHeader('Content-Disposition', `attachment; filename="certificate_${newCertificate.certificate_code || certificateId}.pdf"`);
					res.send(pdfBuffer);

				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
