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
				 *     description: Manually send/resend learning certificate to user (admin only)
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
				 *                 description: Quiz attempt ID
				 *               user_id:
				 *                 type: string
				 *                 description: User ID to send certificate to (optional, if not provided will send to all users)
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const { attempt_id, user_id } = req.body;

					if (!attempt_id) {
						throw new Error("Attempt ID là bắt buộc");
					}

					// Get attempt
					const attempt = await attemptProvider.getById(attempt_id);
					if (!attempt) {
						throw new Error("Không tìm thấy bài ôn tập");
					}

					// Get quiz and content info
					const quiz = await quizProvider.getById(attempt.quiz_id.toString());
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
						// Send to specific user (admin override - no score check)
						const targetUser = await userProvider.getById(user_id);
						if (!targetUser) {
							throw new Error("Không tìm thấy user");
						}

						const certificate = await createAndSendCertificate(
							targetUser, attempt, quiz, content, template, certificateProvider, req
						);

						results.push({
							user_id: targetUser._id.toString(),
							user_email: targetUser.email,
							certificate_id: certificate._id,
							certificate_code: certificate.certificate_code
						});
					} else {
						// Send to all users who passed this quiz (based on passed field)
						const allAttempts = await attemptProvider.getAll({
              where: {
                quiz_id: attempt.quiz_id.toString(),
                passed: true
              },
              includes: [{ path: "user_id", select: "email first_name middle_name last_name profile" }]
            });

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
