import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { ExamParticipantProvider } from "#providers/examParticipantProvider";
import { CertificateProvider } from "#providers/certificateProvider";
import { CertificateTemplateProvider } from "#providers/certificateTemplateProvider";
import { FileProvider } from "#providers/fileProvider";
import { UserProvider } from "#providers/userProvider";
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
		
		console.log(`[CERTIFICATE-SEND] Certificate email (${type}) sent to ${userEmail}`);
	} catch (emailError) {
		console.error("[CERTIFICATE-SEND] Failed to send certificate email:", emailError);
		throw emailError;
	}
}

export default (_express: Application) => {
	const examParticipantProvider = new ExamParticipantProvider();
	const certificateProvider = new CertificateProvider();
	const certificateTemplateProvider = new CertificateTemplateProvider();
	const fileProvider = new FileProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		post: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /exam/certificate/send:
				 *   post:
				 *     tags: [Admin]
				 *     description: Send exam certificate emails to participants
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             required: [exam_id]
				 *             properties:
				 *               exam_id:
				 *                 type: string
				 *                 description: Exam ID
				 *                 example: "6699f4391c7ab023b0a77b5b"
				 *               participant_id:
				 *                 type: string
				 *                 description: Participant ID (optional - send to specific participant)
				 *                 example: "6699f4391c7ab023b0a77b5c"
				 *               user_id:
				 *                 type: string
				 *                 description: User ID (optional - send to all participants of this user in the exam)
				 *                 example: "6699f4391c7ab023b0a77b5d"
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               type: object
				 *               properties:
				 *                 data:
				 *                   type: object
				 *                   properties:
				 *                     total:
				 *                       type: number
				 *                     sent:
				 *                       type: number
				 *                     skipped:
				 *                       type: number
				 *                     errors:
				 *                       type: number
				 *                     details:
				 *                       type: array
				 *                       items:
				 *                         type: object
				 *                 message:
				 *                   type: string
				 */

				try {
					const { exam_id, participant_id, user_id } = req.body;

					if (!exam_id) throw new Error("Exam ID là bắt buộc");
					if (!mongoose.Types.ObjectId.isValid(exam_id)) {
						throw new Error("Exam ID không hợp lệ");
					}

					// Get certificate template
					const template = await certificateTemplateProvider.getByExamId(exam_id);

					if (!template || !template.is_enabled) {
						throw new Error("Không tìm thấy template chứng chỉ hoặc template chưa được bật");
					}

					let participants: any[] = [];

					// Determine which participants to process
					if (participant_id) {
						// Send to specific participant
						if (!mongoose.Types.ObjectId.isValid(participant_id)) {
							throw new Error("Participant ID không hợp lệ");
						}

						const participant = await examParticipantProvider.getById(participant_id, {
							includes: [
								{ path: "exam_id", select: "name" },
								{ path: "user_id", select: "first_name last_name middle_name email phone profile" },
							],
						});

						if (!participant) {
							throw new Error("Không tìm thấy thông tin lượt thi");
						}

						if (participant.exam_id.toString() !== exam_id) {
							throw new Error("Participant không thuộc exam này");
						}

						participants = [participant];
					} else if (user_id) {
						// Send to all participants of this user in the exam
						if (!mongoose.Types.ObjectId.isValid(user_id)) {
							throw new Error("User ID không hợp lệ");
						}

						const participantsResult = await examParticipantProvider.getAll({
							where: {
								exam_id: exam_id,
								user_id: user_id,
								status: "submitted",
								is_graded: true,
							},
							includes: [
								{ path: "exam_id", select: "name" },
								{ path: "user_id", select: "first_name last_name middle_name email phone profile" },
							],
						});

						participants = participantsResult.rows || [];
					} else {
						// Send to all participants in the exam (bulk)
						const participantsResult = await examParticipantProvider.getAll({
							where: {
								exam_id: exam_id,
								status: "submitted",
								is_graded: true,
							},
							includes: [
								{ path: "exam_id", select: "name" },
								{ path: "user_id", select: "first_name last_name middle_name email phone profile" },
							],
						});

						participants = participantsResult.rows || [];
					}

					// Group by user_id, keep only highest score participant per user
					const userBestParticipant = new Map<string, any>();
					for (const p of participants) {
						const userId = (p.user_id as any)._id?.toString() || p.user_id.toString();
						const existing = userBestParticipant.get(userId);
						if (!existing || (p.score || 0) > (existing.score || 0)) {
							userBestParticipant.set(userId, p);
						}
					}
					participants = Array.from(userBestParticipant.values());

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
							const absoluteScore = participant.score || 0;

							const meetsConditions = certificateProvider.checkConditions(
								template,
								absoluteScore,
								totalQuestions,
								correctAnswers
							);

							// Get existing certificate
							let existingCert = await certificateProvider.getByParticipantId(participantId);

							const user = participant.user_id as any;
							const userIdForCert = user._id?.toString() || user.toString();

							// Update existing certificate score if it has percentage score
							if (existingCert && existingCert.exam_info.score > totalQuestions) {
								// Score is percentage, update to absolute score
								await certificateProvider.put(existingCert._id.toString(), {
									exam_info: {
										...existingCert.exam_info,
										score: participant.score || 0
									}
								});
								existingCert = await certificateProvider.getByParticipantId(participantId);
							}

							// Create certificate if not exists and meets conditions
							if (!existingCert && meetsConditions) {
								try {
									existingCert = await certificateProvider.createCertificate({
										type: "exam",
										exam_id: new Types.ObjectId(exam_id),
										user_id: new Types.ObjectId(userIdForCert),
										participant_id: new Types.ObjectId(participantId),
										template_id: template._id,
										user_info: {
											full_name: `${user.last_name || ""} ${user.middle_name || ""} ${user.first_name || ""}`.trim(),
											identity_number: user.profile?.identity_number,
											class_name: user.profile?.class_name,
											school_name: user.profile?.school_name,
										},
										exam_info: {
											name: (participant.exam_id as any)?.name || "",
											completion_date: participant.submit_time || new Date(),
											score: participant.score || 0
										},
										status: "active"
									});
									console.log(`[CERTIFICATE-SEND] Created certificate for participant ${participantId}`);
								} catch (certError) {
									results.push({ participantId, status: "error", reason: "certificate_creation_failed", error: (certError as Error).message });
									errorCount++;
									continue;
								}
							}

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
								
								// Get relative path for storage
								const relativePath = "/" + path.relative(storageRoot, pdfPath).replace(/\\/g, "/");
								
								const pdfStats = fs.statSync(pdfPath);
								
								// Upload PDF to file storage
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
								
								// Use direct static file URL
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
