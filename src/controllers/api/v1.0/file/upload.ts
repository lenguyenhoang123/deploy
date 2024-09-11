import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import LoggingService from "#services/file-system-handlers/logService";
import upload from "#services/file-system-handlers/uploadFileService";
import constants from "#constants/index";
import nconf from "nconf";
import { UserProvider } from "#providers/userProvider";
import { FileProvider } from "#providers/fileProvider";
import fs from "fs";
import { getRelativePathToSave, wrapCompression } from "#services/file-system-handlers/handleFileService";

const compressFileServicePath = `${global.__baseDir}/src/services/compressFileService.${
	global.__baseDir && !global.__baseDir.includes("dist") ? "ts" : "js"
}`;

export default (_express: Application) => {
	const CLASS_NAME = "file.fileController";
	const logger = new LoggingService();

	const provider = new FileProvider();
	const userProvider = new UserProvider();

	return <Resource>{
		post: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /file/upload:
				 *   post:
				 *     tags: [File]
				 *     description: Upload a file
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *       description: File to upload
				 *       required: true
				 *       content:
				 *         multipart/form-data:
				 *           schema:
				 *             $ref: '#/components/schemas/FileUpload'
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */
				await postUploadFile(req, res);
			},
		},
	};

	async function postUploadFile(req: Req, res: Res) {
		const METHOD_NAME = "postUploadFile";
		const SOURCE = `${CLASS_NAME}.${METHOD_NAME}`;
		const compressType = ["desktop", "tablet", "mobile"];
		const mime = (await import("mime")).default;
		let uploadedFilePath: string | null = null;

		try {
			const userId = await userProvider.validateAndFetchUserId(req.user.id as string);

			// Upload file
			await upload(req, res);
			if (!req.file) throw new Error("Vui lòng chọn file cần upload");
			uploadedFilePath = req.file.path;

			// Extract file information
			const mimeTypes = constants.MIME_TYPES,
				originalName = req.file.originalname.split("/").pop(),
				extension = originalName.split(".").pop(),
				mimeType = mime.getType(extension),
				path = {
					fileName: req.file.filename,
					contentType: mimeType,
					originalPath: uploadedFilePath.replace(nconf.get("Storage"), ""),
				},
				relativePath = getRelativePathToSave(uploadedFilePath),
				fileType = Object.keys(mimeTypes).find((key) => mimeTypes[key].includes(req.file.mimetype)) ?? "DEFAULT",
				typesToCompress = fileType == "IMAGE" ? [...compressType, "preload", "preview"] : compressType;

			// Save to DB
			const newFile = {
				file_name: path.fileName,
				original_name: originalName,
				mime_type: mimeType,
				file_type: fileType,
				file_path: relativePath,
				size: req.file.size,
			};
			const data = await provider.post({ ...newFile, created_by: userId, updated_by: userId });

			// Compress file
			Promise.all(
				typesToCompress.map((type) => wrapCompression(compressFileServicePath, type, fileType, req.file, path)),
			).catch((err) => {
				logger.logAsync(METHOD_NAME, SOURCE, err.message, null);
			});

			return res.sendOk({ data: data, message: "Upload file thành công" });
		} catch (error) {
			// Handle database save failure and delete file
			if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
				fs.unlinkSync(uploadedFilePath);
			}

			logger.logAsync(METHOD_NAME, SOURCE, error, null);
			return res.sendError({ err: error });
		}
	}
};
