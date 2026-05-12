import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { LearningQuizAttemptProvider } from "#providers/learningQuizAttemptProvider";
import { LearningQuizProvider } from "#providers/learningQuizProvider";
import { LearningContentProvider } from "#providers/learningContentProvider";
import { UserProvider } from "#providers/userProvider";
import { CertificateProvider } from "#providers/certificateProvider";
import { CertificateTemplateProvider } from "#providers/certificateTemplateProvider";
import { FileProvider } from "#providers/fileProvider";
import MailService from "#services/mailService";
import certificatePdfService from "#services/certificatePdfService";
import fs from "fs";
import path from "path";
import nconf from "nconf";
import { ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { Types } from "mongoose";

function attemptMeetsLearningCertificateTemplate(attempt: any, quiz: any, template: any): boolean {
	if (!attempt || attempt.status === "in_progress") return false;

	const totalQuestions = Array.isArray(attempt.shuffled_questions) ? attempt.shuffled_questions.length : 0;
	const total =
		totalQuestions > 0 ? totalQuestions : Math.max(1, Number(quiz?.total_score) || 1);
	const score = Number(attempt.score ?? 0);

	if (template?.conditions?.require_all_correct === true) {
		return totalQuestions > 0 && score >= totalQuestions;
	}

	const minPct = Number(template?.conditions?.min_score ?? 0);
	const pct = total > 0 ? (score / total) * 100 : 0;
	if (minPct <= 0) {
		return score > 0;
	}
	return pct >= minPct;
}

// Import shared certificate email function from exam
async function sendCertificateEmail(
	user: any,
	certificate: any,
	participant: any,
	newScore: number,
	totalQuestions: number,
	type: "new" | "updated" | "revoked" = "new"
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
		
		const emailContent = emailTemplate
			.replace("{{user_full_name}}", userName)
			.replace("{{certificate_code}}", certificate.certificate_code || "")
			.replace("{{exam_name}}", (participant.quiz_id as any)?.title || "Bài ôn tập")
			.replace("{{exam_score}}", newScore.toString())
			.replace("{{total_questions}}", totalQuestions.toString())
			.replace("{{completion_date}}", new Date(participant.end_time || Date.now()).toLocaleDateString("vi-VN"))
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
		
		console.log(`[ADMIN-SEND] Certificate email (${type}) sent to ${userEmail}`);
	} catch (emailError) {
		console.error("[ADMIN-SEND] Failed to send certificate email:", emailError);
		throw emailError;
	}
}

// Helper function to create and send certificate
async function createAndSendCertificate(
	user: any,
	attempt: any,
	quiz: any,
	content: any,
	template: any,
	certificateProvider: CertificateProvider,
	req: Req
) {
	const fileProvider = new FileProvider();
	
	// Check if user already has certificate for this content (1 user = 1 certificate per content)
	const existingCerts = await certificateProvider.getAll({
		where: {
			user_id: user._id.toString(),
			content_id: quiz.content_id.toString(),
			type: "learning_quiz"
		},
		pageSize: 1
	});
	
	let certificate;
	if (existingCerts.rows.length > 0) {
		// User already has certificate for this content - use existing
		certificate = existingCerts.rows[0];
		console.log(`[ADMIN-SEND] User ${user.email} already has certificate for content ${quiz.content_id}, reusing existing`);
		
		// If certificate doesn't have file_url, generate PDF now
		if (!certificate.file_url) {
			console.log(`[ADMIN-SEND] Certificate ${certificate.certificate_code} missing PDF, generating now...`);
			
			const pdfFileName = `certificate_${certificate.certificate_code}_${uuidv4()}.pdf`;
			const storageRoot = path.resolve(nconf.get("Storage") || "./storage");
			const storageDir = path.join(storageRoot, "certificates");
			const pdfPath = path.join(storageDir, pdfFileName);
			
			if (!fs.existsSync(storageDir)) {
				fs.mkdirSync(storageDir, { recursive: true });
			}
			
			try {
				await certificatePdfService.generateCertificatePdf(certificate, template, pdfPath);
				
				const relativePath = "/" + path.relative(storageRoot, pdfPath).replace(/\\/g, "/");
				const pdfStats = fs.statSync(pdfPath);
				
				const fileDoc = await fileProvider.post({
					file_name: pdfFileName,
					original_name: `${certificate.certificate_code}.pdf`,
					mime_type: "application/pdf",
					file_type: "DEFAULT",
					file_path: relativePath,
					size: pdfStats.size,
					created_by: new Types.ObjectId(req.user.id as string),
					updated_by: new Types.ObjectId(req.user.id as string),
				});
				
				await certificateProvider.put(certificate._id.toString(), {
					file_id: fileDoc._id,
					file_url: relativePath,
				});
				
				certificate.file_url = relativePath;
				console.log(`[ADMIN-SEND] Generated PDF for existing cert: ${relativePath}`);
			} catch (pdfError) {
				console.error(`[ADMIN-SEND] Failed to generate PDF: ${pdfError.message}`);
			}
		}
	} else {
		// Create new certificate
		certificate = await certificateProvider.createCertificate({
			type: "learning_quiz",
			user_id: new ObjectId(user._id.toString()),
			quiz_attempt_id: new ObjectId(attempt._id.toString()),
			content_id: new ObjectId(quiz.content_id.toString()),
			quiz_id: new ObjectId(attempt.quiz_id.toString()),
			template_id: new ObjectId(template._id.toString()),
			user_info: {
				full_name: `${user.last_name || ""} ${user.middle_name || ""} ${user.first_name || ""}`.trim(),
				identity_number: user.profile?.identity_number,
				class_name: user.profile?.class_name,
				school_name: user.profile?.school_name,
			},
			exam_info: {
				name: content?.title || quiz.title || "Bài ôn tập",
				completion_date: attempt.end_time || new Date(),
				score: attempt.score || 0
			},
			status: "active"
		});
		
		// Generate PDF certificate
		let pdfUrl = "";
		try {
			const pdfFileName = `certificate_${certificate.certificate_code}_${uuidv4()}.pdf`;
			const storageRoot = path.resolve(nconf.get("Storage") || "./storage");
			const storageDir = path.join(storageRoot, "certificates");
			const pdfPath = path.join(storageDir, pdfFileName);
			
			// Ensure directory exists
			if (!fs.existsSync(storageDir)) {
				fs.mkdirSync(storageDir, { recursive: true });
			}
			
			// Generate PDF
			await certificatePdfService.generateCertificatePdf(certificate, template, pdfPath);
			
			// Get relative path for storage
			const relativePath = "/" + path.relative(storageRoot, pdfPath).replace(/\\/g, "/");
			
			const pdfStats = fs.statSync(pdfPath);
			
			// Upload PDF to file storage
			const fileDoc = await fileProvider.post({
				file_name: pdfFileName,
				original_name: `${certificate.certificate_code}.pdf`,
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
			await certificateProvider.put(certificate._id.toString(), {
				file_id: fileDoc._id,
				file_url: pdfUrl,
			});
			
			// Update certificate object for email
			certificate.file_url = pdfUrl;
			
			console.log(`[ADMIN-SEND] Generated PDF for certificate ${certificate.certificate_code}: ${pdfUrl}`);
		} catch (pdfError) {
			console.error(`[ADMIN-SEND] PDF generation failed: ${pdfError.message}`);
			// Continue without PDF - certificate is still created
		}
	}

	// Send email
	await sendCertificateEmail(
		user,
		certificate,
		attempt,
		attempt.score || 0,
		attempt.shuffled_questions?.length || 0,
		"new"
	);

	return certificate;
}

export default (_express: Application) => {
	const attemptProvider = new LearningQuizAttemptProvider();
	const quizProvider = new LearningQuizProvider();
	const contentProvider = new LearningContentProvider();
	const userProvider = new UserProvider();
	const certificateProvider = new CertificateProvider();
	const certificateTemplateProvider = new CertificateTemplateProvider();

	return <Resource>{
		post: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/certificate/send:
				 *   post:
				 *     tags: [Admin Learning Certificate]
				 *     description: Send/resend learning certificate (admin). Every mode checks the content certificate template (min_score %, require_all_correct). Bulk = content_id without user_id; single = user_id and/or attempt_id.
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             properties:
				 *               attempt_id:
				 *                 type: string
				 *                 description: Quiz attempt ID — alone sends that attempt (if template OK); with user_id must belong to that user
				 *               content_id:
				 *                 type: string
				 *                 description: Learning content ID (required if attempt_id not provided)
				 *               user_id:
				 *                 type: string
				 *                 description: User ID (optional). With content_id, sends only if that user's latest attempt meets template. If omitted with content_id only, bulk-send to all eligible users.
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const { attempt_id, user_id, content_id } = req.body;

					if (!attempt_id && !content_id) {
						throw new Error("Attempt ID hoặc Content ID là bắt buộc");
					}

					let attempt: any = null;
					let quiz: any = null;

					if (attempt_id) {
						// Get attempt
						attempt = await attemptProvider.getById(attempt_id);
						if (!attempt) {
							throw new Error("Không tìm thấy bài ôn tập");
						}
						// Get quiz from attempt
						quiz = await quizProvider.getById(attempt.quiz_id.toString());
					} else if (content_id) {
						// Find quiz by content_id
						const quizzes = await quizProvider.getAll({
							where: { content_id: content_id }
						});
						if (!quizzes.rows || quizzes.rows.length === 0) {
							throw new Error("Không tìm thấy quiz cho content này");
						}
						quiz = quizzes.rows[0];

						// If user_id provided, find their latest attempt for this quiz
						if (user_id) {
							const userAttempts = await attemptProvider.getAll({
								where: { user_id: user_id, quiz_id: quiz._id.toString() },
								sortField: "created_at",
								sortOrder: "desc",
								pageSize: 1
							});
							if (!userAttempts.rows || userAttempts.rows.length === 0) {
								throw new Error("Không tìm thấy attempt nào của user cho quiz này");
							}
							attempt = userAttempts.rows[0];
						}
					}

					if (!quiz || !quiz.content_id) {
						throw new Error("Không tìm thấy thông tin quiz hoặc content");
					}

					const content = await contentProvider.getById(quiz.content_id.toString());

					// Get template
					const template = await certificateTemplateProvider.getByContentId(quiz.content_id.toString()) ||
								   await certificateTemplateProvider.getGlobalTemplate("learning_quiz");

					if (!template) {
						throw new Error("Không có template chứng chỉ");
					}

					let results = [];

					if (user_id) {
						const targetUser = await userProvider.getById(user_id);
						if (!targetUser) {
							throw new Error("Không tìm thấy user");
						}

						const targetAttempt =
							attempt ||
							(await attemptProvider
								.getAll({
									where: { user_id: user_id, quiz_id: quiz._id.toString() },
									sortField: "created_at",
									sortOrder: "desc",
									pageSize: 1,
								})
								.then((r) => r.rows?.[0]));

						if (!targetAttempt) {
							throw new Error("Không tìm thấy attempt của user");
						}

						if (attempt_id) {
							const ownerId =
								targetAttempt.user_id?._id?.toString?.() ??
								targetAttempt.user_id?.toString?.() ??
								String(targetAttempt.user_id);
							if (ownerId !== user_id.toString()) {
								throw new Error("Attempt không thuộc user này");
							}
						}

						if (!attemptMeetsLearningCertificateTemplate(targetAttempt, quiz, template)) {
							throw new Error(
								"Bài làm chưa đạt điều kiện chứng chỉ theo mẫu (min_score / require_all_correct).",
							);
						}

						const certificate = await createAndSendCertificate(
							targetUser,
							targetAttempt,
							quiz,
							content,
							template,
							certificateProvider,
							req,
						);

						results.push({
							user_id: targetUser._id.toString(),
							user_email: targetUser.email,
							certificate_id: certificate._id,
							certificate_code: certificate.certificate_code,
						});
					} else if (attempt_id && attempt) {
						const ownerId =
							attempt.user_id?._id?.toString?.() ??
							attempt.user_id?.toString?.() ??
							String(attempt.user_id);
						const targetUser = await userProvider.getById(ownerId);
						if (!targetUser) {
							throw new Error("Không tìm thấy user của attempt");
						}

						if (!attemptMeetsLearningCertificateTemplate(attempt, quiz, template)) {
							throw new Error(
								"Bài làm chưa đạt điều kiện chứng chỉ theo mẫu (min_score / require_all_correct).",
							);
						}

						const certificate = await createAndSendCertificate(
							targetUser,
							attempt,
							quiz,
							content,
							template,
							certificateProvider,
							req,
						);

						results.push({
							user_id: targetUser._id.toString(),
							user_email: targetUser.email,
							certificate_id: certificate._id,
							certificate_code: certificate.certificate_code,
						});
					} else if (content_id) {
						const allAttemptsRaw = await attemptProvider.getAll({
							where: {
								quiz_id: quiz._id.toString(),
								status: { $in: ["completed", "failed"] },
							},
							sortField: "created_at",
							sortOrder: "desc",
							includes: [{ path: "user_id", select: "email first_name middle_name last_name profile" }],
						});

						const allAttempts = {
							rows: allAttemptsRaw.rows.filter((row: any) =>
								attemptMeetsLearningCertificateTemplate(row, quiz, template),
							),
						};

            // Track which users already processed to avoid duplicates
            const processedUsers = new Set<string>();

            for (const userAttempt of allAttempts.rows) {
              const targetUser = userAttempt.user_id as any;
              const userId = targetUser._id.toString();

              // Skip if already processed this user
              if (processedUsers.has(userId)) {
                continue;
              }
              processedUsers.add(userId);

              // Check if user already has certificate for this content
              const existingCerts = await certificateProvider.getAll({
                where: {
                  user_id: userId,
                  content_id: quiz.content_id.toString(),
                  type: "learning_quiz"
                },
                pageSize: 1
              });

              if (existingCerts.rows.length > 0) {
                // Resend existing certificate
                let existingCert = existingCerts.rows[0];

                // If certificate doesn't have file_url, generate PDF now
                if (!existingCert.file_url) {
                  console.log(`[ADMIN-SEND] Certificate ${existingCert.certificate_code} missing PDF, generating now...`);

                  const fileProvider = new FileProvider();
                  const pdfFileName = `certificate_${existingCert.certificate_code}_${uuidv4()}.pdf`;
                  const storageRoot = path.resolve(nconf.get("Storage") || "./storage");
                  const storageDir = path.join(storageRoot, "certificates");
                  const pdfPath = path.join(storageDir, pdfFileName);

                  if (!fs.existsSync(storageDir)) {
                    fs.mkdirSync(storageDir, { recursive: true });
                  }

                  try {
                    await certificatePdfService.generateCertificatePdf(existingCert, template, pdfPath);

                    const relativePath = "/" + path.relative(storageRoot, pdfPath).replace(/\\/g, "/");
                    const pdfStats = fs.statSync(pdfPath);

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

                    await certificateProvider.put(existingCert._id.toString(), {
                      file_id: fileDoc._id,
                      file_url: relativePath,
                    });

                    existingCert.file_url = relativePath;
                  } catch (pdfError) {
                    console.error(`[ADMIN-SEND] Failed to generate PDF for existing cert: ${pdfError.message}`);
                  }
                }

                await sendCertificateEmail(
                  targetUser,
                  existingCert,
                  userAttempt,
                  userAttempt.score || 0,
                  userAttempt.shuffled_questions?.length || 0,
                  "new"
                );

                results.push({
                  user_id: userId,
                  user_email: targetUser.email,
                  certificate_id: existingCert._id,
                  certificate_code: existingCert.certificate_code,
                  status: "resent"
                });
              } else {
                // Create new certificate (no existing certificate)

                const certificate = await createAndSendCertificate(
                  targetUser, userAttempt, quiz, content, template, certificateProvider, req
                );

                results.push({
                  user_id: userId,
                  user_email: targetUser.email,
                  certificate_id: certificate._id,
                  certificate_code: certificate.certificate_code,
                  status: "created"
                });
              }
            }
          } else {
						throw new Error(
							"Không thể gửi: dùng content_id (hàng loạt), hoặc attempt_id (một lần làm), hoặc user_id kèm content_id/attempt_id.",
						);
					}

        return res.sendOk({
          data: {
            sent_count: results.length,
            results: results
          },
          message: `Đã gửi chứng chỉ thành công cho ${results.length} user`
        });
      } catch (error) {
        return res.sendError({ err: error });
      }
    },
  },
};
};
