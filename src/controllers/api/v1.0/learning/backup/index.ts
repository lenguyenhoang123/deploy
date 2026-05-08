import verify from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { LearningProgressProvider } from "#providers/learningProgressProvider";
import { LearningQuizAttemptProvider } from "#providers/learningQuizAttemptProvider";
import { UserProvider } from "#providers/userProvider";
import * as XLSX from 'exceljs';
import fs from 'fs';
import path from 'path';

export default (_express: Application) => {
	const progressProvider = new LearningProgressProvider();
	const attemptProvider = new LearningQuizAttemptProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		get: {
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/backup:
				 *   get:
				 *     tags: [Learning Backup]
				 *     description: Export user learning data to Excel for local backup
				 *     security:
				 *       - Bearer: []
				 *     responses:
				 *       200:
				 *         description: Success - Excel file
				 *         content:
				 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
				 *             schema:
				 *               type: string
				 *               format: binary
				 */
				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);

					// Get user info
					const user = await userProvider.getById(userId);

					// Get learning progress
					const progressData = await progressProvider.getCompletedContent(userId);

					// Get quiz attempts
					const attempts = await attemptProvider.getPassedAttempts(userId);

					// Create Excel workbook
					const workbook = new XLSX.Workbook();
					
					// Add metadata sheet
					const metadataSheet = workbook.addWorksheet('Thông tin người dùng');
					metadataSheet.addRow(['Họ và tên', `${user.first_name} ${user.last_name}`]);
					metadataSheet.addRow(['Email', user.email]);
					metadataSheet.addRow(['Số điện thoại', user.phone]);
					metadataSheet.addRow(['Ngày xuất dữ liệu', new Date().toLocaleString('vi-VN')]);
					metadataSheet.addRow(['Tổng số nội dung đã hoàn thành', progressData.rows.length]);
					metadataSheet.addRow(['Số chứng chỉ đạt được', attempts.rows.length]);

					// Add learning progress sheet
					if (progressData.rows.length > 0) {
						const progressSheet = workbook.addWorksheet('Tiến độ học tập');
						progressSheet.columns = [
							{ header: 'Nội dung học tập', key: 'content_title', width: 30 },
							{ header: 'Loại nội dung', key: 'content_type', width: 15 },
							{ header: 'Thời gian ước tính', key: 'estimated_time', width: 15 },
							{ header: 'Độ khó', key: 'difficulty', width: 10 },
							{ header: 'Tiến độ', key: 'progress', width: 10 },
							{ header: 'Thời gian học', key: 'time_spent', width: 15 },
							{ header: 'Ngày hoàn thành', key: 'completed_at', width: 20 }
						];

						progressData.rows.forEach(progress => {
							const content = progress.content_id as any;
							progressSheet.addRow({
								content_title: content?.title || 'N/A',
								content_type: content?.type || 'N/A',
								estimated_time: `${content?.estimated_reading_time || 0} phút`,
								difficulty: content?.difficulty_level || 'N/A',
								progress: `${progress.progress_percentage}%`,
								time_spent: `${progress.time_spent || 0} phút`,
								completed_at: progress.completed_at ? new Date(progress.completed_at).toLocaleString('vi-VN') : 'N/A'
							});
						});
					}

					// Add quiz results sheet
					if (attempts.rows.length > 0) {
						const quizSheet = workbook.addWorksheet('Kết quả trắc nghiệm');
						quizSheet.columns = [
							{ header: 'Bài trắc nghiệm', key: 'quiz_title', width: 30 },
							{ header: 'Lượt thi', key: 'attempt_number', width: 10 },
							{ header: 'Điểm số', key: 'score', width: 10 },
							{ header: 'Kết quả', key: 'result', width: 10 },
							{ header: 'Thời gian làm bài', key: 'time_taken', width: 15 },
							{ header: 'Ngày thi', key: 'completion_date', width: 20 },
						
						];

						attempts.rows.forEach(attempt => {
							const quiz = attempt.quiz_id as any;
							quizSheet.addRow({
								quiz_title: quiz?.title || 'N/A',
								attempt_number: attempt.attempt_number,
								score: `${attempt.score || 0}%`,
								result: attempt.passed ? 'Đạt' : 'Chưa đạt',
								time_taken: `${attempt.time_taken || 0} phút`,
								completion_date: attempt.end_time ? new Date(attempt.end_time).toLocaleString('vi-VN') : 'N/A',
								certificate_code: attempt.passed ? attempt._id?.toString() : 'Không đạt'
							});
						});
					}

					// Add certificates sheet
					const certificateSheet = workbook.addWorksheet('Chứng chỉ');
					certificateSheet.columns = [
						{ header: 'Mã chứng chỉ', key: 'code', width: 25 },
						{ header: 'Khóa học', key: 'course', width: 30 },
						{ header: 'Điểm số', key: 'score', width: 10 },
						{ header: 'Ngày cấp', key: 'issued_date', width: 20 },
						{ header: 'Link tải chứng chỉ', key: 'download_link', width: 40 }
					];

					attempts.rows.filter(attempt => attempt.passed).forEach(attempt => {
						const quiz = attempt.quiz_id as any;
						certificateSheet.addRow({
							code: attempt._id?.toString(),
							course: quiz?.title || 'N/A',
							score: `${attempt.score || 0}%`,
							issued_date: attempt.end_time ? new Date(attempt.end_time).toLocaleDateString('vi-VN') : 'N/A',
							download_link: `https://your-domain.com/learning/certificate/${attempt._id}`
						});
					});

					// Generate buffer
					const buffer = await workbook.xlsx.writeBuffer();

					// Set response headers
					const fileName = `learning_backup_${user.first_name}_${user.last_name}_${new Date().toISOString().split('T')[0]}.xlsx`;
					res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
					res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
					res.send(buffer);

				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		post: {
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /learning/backup:
				 *   post:
				 *     tags: [Learning Backup]
				 *     description: Create backup of user data and save to server
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *       content:
				 *         application/json:
				 *           schema:
				 *             type: object
				 *             properties:
				 *               include_certificates:
				 *                 type: boolean
				 *                 default: true
				 *     responses:
				 *       200:
				 *         description: Success
				 */
				try {
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const { include_certificates = true } = req.body;

					// Get user data
					const user = await userProvider.getById(userId);
					const progressData = await progressProvider.getCompletedContent(userId);
					const attempts = await attemptProvider.getPassedAttempts(userId);

					// Create backup data structure
					const backupData = {
						user_info: {
							full_name: `${user.first_name} ${user.last_name}`,
							email: user.email,
							phone: user.phone,
							backup_date: new Date().toISOString()
						},
						learning_progress: progressData.rows.map(progress => {
							const content = progress.content_id as any;
							return {
								content_title: content?.title,
								content_type: content?.type,
								progress_percentage: progress.progress_percentage,
								time_spent_minutes: progress.time_spent,
								completed_at: progress.completed_at
							};
						}),
						quiz_attempts: attempts.rows.map(attempt => {
							const quiz = attempt.quiz_id as any;
							return {
								quiz_title: quiz?.title,
								attempt_number: attempt.attempt_number,
								score_percentage: attempt.score,
								passed: attempt.passed,
								time_taken_minutes: attempt.time_taken,
								completion_date: attempt.end_time
							};
						}),
						certificates: include_certificates ? attempts.rows.filter(attempt => attempt.passed).map(attempt => {
							const quiz = attempt.quiz_id as any;
							return {
								certificate_id: attempt._id,
								course_title: quiz?.title,
								score: attempt.score,
								issued_date: attempt.end_time,
								download_url: `/learning/certificate/${attempt._id}`
							};
						}) : []
					};

					// Save backup to file system (optional)
					const backupDir = path.join(process.cwd(), 'backups', 'learning');
					if (!fs.existsSync(backupDir)) {
						fs.mkdirSync(backupDir, { recursive: true });
					}

					const backupFileName = `backup_${userId}_${new Date().toISOString().split('T')[0]}.json`;
					const backupPath = path.join(backupDir, backupFileName);
					fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

					return res.sendOk({
						data: {
							backup_data: backupData,
							file_name: backupFileName,
							file_path: backupPath
						},
						message: "Tạo backup dữ liệu thành công"
					});
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
