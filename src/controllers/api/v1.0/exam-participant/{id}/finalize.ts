import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";
import { CertificateProvider } from "#providers/certificateProvider";
import { CertificateTemplateProvider } from "#providers/certificateTemplateProvider";
import { FileProvider } from "#providers/fileProvider";
import mongoose, { Types, ObjectId } from "mongoose";
import MailService from "#services/mailService";
import certificatePdfService from "#services/certificatePdfService";
import fs from "fs";
import path from "path";
import nconf from "nconf";
import { v4 as uuidv4 } from "uuid";

async function sendCertificateEmail(
	user: any,
	certificate: any,
	participant: any,
	newScore: number,
	totalQuestions: number,
	type: "new" | "updated" | "revoked"
) {
	try {
		const mailService = new MailService();
		const templatePath = path.join(process.cwd(), "src/templates/email/certificate.html");
		const emailTemplate = fs.readFileSync(templatePath, "utf8");
		
		const userEmail = user.email;
		const userName = `${user.last_name || ""} ${user.middle_name || ""} ${user.first_name || ""}`.trim();
		
		let subject = "🎉 Chúc mừng bạn đã đạt chứng chỉ!";
		if (type === "updated") {
			subject = "📝 Chứng chỉ của bạn đã được cập nhật";
		} else if (type === "revoked") {
			subject = "⚠️ Chứng chỉ của bạn đã bị thu hồi";
		}
		
		let emailContent = emailTemplate
			.replace("{{user_full_name}}", userName)
			.replace("{{certificate_code}}", certificate.certificate_code || "")
			.replace("{{exam_name}}", (participant.exam_id as any).name || "")
			.replace("{{exam_score}}", newScore.toString())
			.replace("{{total_questions}}", totalQuestions.toString())
			.replace("{{completion_date}}", new Date(participant.submit_time || Date.now()).toLocaleDateString("vi-VN"))
			.replace("{{school_name}}", user.profile?.school_name || "")
			.replace("{{class_name}}", user.profile?.class_name || "")
			.replace("{{certificate_link}}", `${process.env.BACKEND_URL || "http://localhost:3000"}${certificate.file_url || ""}`)
		.replace("{{pdf_link}}", certificate.file_url || "");
		
		await mailService.sendmail({
			from: nconf.get("smtpOptions:auth:user"),
			to: userEmail,
			subject,
			html: emailContent,
		});
	} catch (emailError) {
		// Don't fail the main operation if email fails
	}
}

export default (_express: Application) => {
	const examParticipantProvider = new ExamParticipantProvider();

	return <Resource>{
		post: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam-participant/{id}/finalize:
				 *   post:
				 *     tags: [Admin]
				 *     description: Finalize grading and send certificate email
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *         description: Exam Participant ID
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
					const participantId = req.params.id as string;
					if (!participantId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(participantId)) {
						throw new Error("ID không hợp lệ");
					}

					// Get participant with exam and user info
					const participant = await examParticipantProvider.getById(participantId, {
						includes: [
							{ path: "exam_id", select: "name" },
							{ path: "user_id", select: "first_name last_name middle_name email phone profile" },
						],
					});
					if (!participant) {
						throw new Error("Không tìm thấy thông tin lượt thi");
					}

					// Check if all essays are graded
					const hasUngradedEssay = participant.answers.some((a: any) => a.is_correct === null);
					if (hasUngradedEssay) {
						throw new Error("Vui lòng chấm điểm tất cả các câu hỏi tự luận trước khi hoàn tất");
					}

					// Check if already finalized
					if ((participant as any).finalized) {
						throw new Error("Kết quả đã được hoàn tất");
					}

					const certificateProvider = new CertificateProvider();
					const certificateTemplateProvider = new CertificateTemplateProvider();
					const fileProvider = new FileProvider();

					const examId = (participant.exam_id as any)._id?.toString() || (participant.exam_id as any).toString();
				
					
					const template = await certificateTemplateProvider.getByExamId(examId);
				
					
					if (template && template.is_enabled) {
						const totalQuestions = participant.answers.length;
						const correctAnswers = participant.answers.filter((a: any) => a.is_correct === true).length;
						const percentageScore = totalQuestions > 0 ? (participant.score / totalQuestions) * 100 : 0;

						const meetsConditions = certificateProvider.checkConditions(
							template,
							percentageScore,
							totalQuestions,
							correctAnswers
						);

						let existingCert = await certificateProvider.getByParticipantId(participantId);
						
						const user = participant.user_id as any;
						const userIdForCert = user._id?.toString() || user.toString();

						// Temporarily reset for testing
if (existingCert && existingCert.certificateNotified) {
	await certificateProvider.put(existingCert._id.toString(), {
		certificateNotified: false,
	});
	// Re-fetch certificate to get updated state
	existingCert = await certificateProvider.getByParticipantId(participantId);
}

if (meetsConditions && existingCert && !existingCert.certificateNotified) {
							
							// Generate PDF certificate
							let pdfUrl = "";
							try {
								const pdfFileName = `certificate_${existingCert.certificate_code}_${uuidv4()}.pdf`;
								const storageRoot = path.resolve(nconf.get("Storage") || "./storage");
								const storageDir = path.join(storageRoot, "certificates");
								const pdfPath = path.join(storageDir, pdfFileName);
								
								// Ensure directory exists
								if (!fs.existsSync(storageDir)) {
									fs.mkdirSync(storageDir, { recursive: true });
								}
								
								// Generate PDF
								await certificatePdfService.generateCertificatePdf(existingCert, template, pdfPath);
								
								// Get relative path for storage (manual calculation to avoid nconf issues)
								const relativePath = "/" + path.relative(storageRoot, pdfPath).replace(/\\/g, "/");
									
								const pdfStats = fs.statSync(pdfPath);
								
								// Upload PDF to file storage using provider.post
								const fileDoc = await fileProvider.post({
									file_name: pdfFileName,
									original_name: `${existingCert.certificate_code}.pdf`,
									mime_type: "application/pdf",
									file_type: "DEFAULT",
									file_path: relativePath,
									size: pdfStats.size,
									created_by: new Types.ObjectId(req.user.id as string),
									updated_by: new Types.ObjectId(req.user.id as string),
								});
								
								// Use direct static file URL instead of API endpoint
								pdfUrl = relativePath;
								
								// Update certificate with file info
								await certificateProvider.put(existingCert._id.toString(), {
									file_id: fileDoc._id,
									file_url: pdfUrl,
								});
								
								// Update existingCert for email
								existingCert.file_url = pdfUrl;
								
															} catch (pdfError) {
								
								// Do not send email if PDF fails - throw error to stop the process
								throw new Error(`PDF generation failed: ${pdfError.message}`);
							}
							
													// Send email with PDF link
							// await sendCertificateEmail(
							// 	user, 
							// 	existingCert, 
							// 	participant, 
							// 	participant.score || 0, 
							// 	totalQuestions, 
							// 	"new"
							// );

							// Mark as notified
							await certificateProvider.put(existingCert._id.toString(), {
								certificateNotified: true,
							});
						} else {
						}
					}

					// Mark participant as finalized
					await examParticipantProvider.put(participantId, {
						finalized: true,
					});

					return res.sendOk({
						data: null,
						message: "Hoàn tất chấm điểm thành công",
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
