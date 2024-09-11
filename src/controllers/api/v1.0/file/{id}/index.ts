import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { FileProvider } from "#providers/fileProvider";
import { UserProvider } from "#providers/userProvider";
import LoggingService from "#services/file-system-handlers/logService";
import mongoose from "mongoose";

export default (_express: Application) => {
	const provider = new FileProvider();
	const userProvider = new UserProvider();
	const CLASS_NAME = "file.fileController";
	const logger = new LoggingService();

	return <Resource>{
		get: {
			middleware: [verify],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /file/{id}:
				 *   get:
				 *     tags: [File]
				 *     description: Get file by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: File ID
				 *         required: true
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				const METHOD_NAME = "getFile";
				const SOURCE = `${CLASS_NAME}.${METHOD_NAME}`;
				try {
					const fileId = req.params.id as string;
					if (!fileId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(fileId)) throw new Error("ID không hợp lệ");

					await userProvider.validateUserId(req.user.id as string);

					const data = await provider.getById(fileId, {
						attributes: [
							"file_name",
							"original_name",
							"mime_type",
							"file_type",
							"file_path",
							"size",
							"created_by",
							"updated_by",
							"created_at",
							"updated_at",
						],
					});
					if (!data) throw new Error("File không tồn tại");

					return res.sendOk({
						data: data,
						message: "Lấy thông tin file thành công",
					});
				} catch (error) {
					logger.logAsync(METHOD_NAME, SOURCE, error, null);
					return res.sendError({ err: error });
				}
			},
		},
	};
};
