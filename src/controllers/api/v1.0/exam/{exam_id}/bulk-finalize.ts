import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";
import { CertificateProvider } from "#providers/certificateProvider";
import { CertificateTemplateProvider } from "#providers/certificateTemplateProvider";
import { FileProvider } from "#providers/fileProvider";
import mongoose, { Types } from "mongoose";
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
		
		console.log(`[BULK-FINALIZE] Certificate email (${type}) sent to ${userEmail}`);
	} catch (emailError) {
		console.error("[BULK-FINALIZE] Failed to send certificate email:", emailError);
		throw emailError;
	}
}

export default (_express: Application) => {
	const examParticipantProvider = new ExamParticipantProvider();
	const certificateProvider = new CertificateProvider();
	const certificateTemplateProvider = new CertificateTemplateProvider();
	const fileProvider = new FileProvider();

	return <Resource>{
		post: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/{exam_id}/bulk-finalize:
				 *   post:
				 *     tags: [Admin]
				 *     description: Bulk finalize and send certificate emails to all eligible participants
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: exam_id
				 *         in: path
				 *         schema:
				 *           type: string
				 *         description: Exam ID
				 *         required: true
				 *     responses:
				 *       200:
				 *         description: Success
				 */

				try {
					const examId = req.params.exam_id as string;
					if (!examId) throw new Error("Exam ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(examId)) {
						throw new Error("Exam ID không hợp lệ");
					}

					// Get certificate template
					const template = await certificateTemplateProvider.getByExamId(examId);
					if (!template || !template.is_enabled) {
						throw new Error("Không tìm thấy template chứng chỉ hoặc template chưa được bật");
					}

					// Find all submitted participants with certificates
					const participantsResult = await examParticipantProvider.getAll({
						where: {
							exam_id: examId,
							status: "submitted",
							is_graded: true,
						},
						includes: [
							{ path: "exam_id", select: "name" },
							{ path: "user_id", select: "first_name last_name middle_name email phone profile" },
						],
					});
					
					const participants = participantsResult.rows || [];

	
					let sentCount = 0;
					let skippedCount = 0;
					let errorCount = 0;
					const results: any[] = [];

					for (const participant of participants) {
						try {
							const participantId = participant._id.toString();
							
							// Check if all essays are graded
							const hasUngradedEssay = participant.answers.some((a: any) => a.is_correct === null);
							if (hasUngradedEssay) {
									skippedCount++;
								results.push({ participantId, status: "skipped", reason: "has_ungraded_essays" });
								continue;
							}

							// Calculate score and check conditions
							const totalQuestions = participant.answers.length;
							const correctAnswers = participant.answers.filter((a: any) => a.is_correct === true).length;
							const percentageScore = totalQuestions > 0 ? (participant.score / totalQuestions) * 100 : 0;
							const meetsConditions = certificateProvider.checkConditions(
								template,
								percentageScore,
								totalQuestions,
								correctAnswers
							);

							// Get existing certificate
							const existingCert = await certificateProvider.getByParticipantId(participantId);
							
							if (!existingCert) {
								skippedCount++;
								results.push({ participantId, status: "skipped", reason: "no_certificate" });
								continue;
							}

							if (!meetsConditions) {
								skippedCount++;
								results.push({ participantId, status: "skipped", reason: "does_not_meet_conditions" });
								continue;
							}

							if (existingCert.certificateNotified) {
								skippedCount++;
								results.push({ participantId, status: "skipped", reason: "already_notified" });
								continue;
							}

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
								// Skip this participant - do not send email without PDF
								results.push({ participantId, status: "error", reason: "pdf_generation_failed", error: pdfError.message });
								errorCount++;
								continue;
							}

							// Send email
							const user = participant.user_id as any;
							await sendCertificateEmail(
								user,
								existingCert,
								participant,
								participant.score || 0,
								totalQuestions,
								"new"
							);

							// Mark as notified
							await certificateProvider.put(existingCert._id.toString(), {
								certificateNotified: true,
							});

							sentCount++;
							results.push({ participantId, status: "sent", email: user.email, pdfUrl });

						} catch (error) {
							errorCount++;
							results.push({ participantId: participant._id.toString(), status: "error", error: (error as Error).message });
						}
					}

	
					return res.sendOk({
						data: {
							total: participants.length,
							sent: sentCount,
							skipped: skippedCount,
							errors: errorCount,
							details: results,
						},
						message: `Đã gửi ${sentCount} email chứng chỉ cho ${participants.length} thí sinh`,
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
