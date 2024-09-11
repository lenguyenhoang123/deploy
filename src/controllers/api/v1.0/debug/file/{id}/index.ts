import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { FileProvider } from "#providers/fileProvider";
import { UserProvider } from "#providers/userProvider";
import LoggingService from "#services/file-system-handlers/logService";
import mongoose from "mongoose";
import { deleteFile } from "#services/file-system-handlers/handleFileService";

export default (_express: Application) => {
	const provider = new FileProvider();
	const userProvider = new UserProvider();
	const CLASS_NAME = "file.fileController";
	const logger = new LoggingService();

	return <Resource>{
		delete: {
			middleware: [verify, verifyAdmin],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /debug/file/{id}:
				 *   delete:
				 *     tags: [Debug]
				 *     description: Delete file by ID.
				 *     security:
				 *       - Bearer: []
				 *     parameters:
				 *       - name: id
				 *         in: path
				 *         schema:
				 *           type: string
				 *           example: 6699f4391c7ab023b0a77b5b
				 *         description: ID to delete
				 *         required: true
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *             schema:
				 *               $ref: '#/components/schemas/Response'
				 */

				const METHOD_NAME = "deleteFile";
				const SOURCE = `${CLASS_NAME}.${METHOD_NAME}`;
				try {
					const deleteId = req.params.id as string;
					if (!deleteId) throw new Error("ID không được để trống");
					if (!mongoose.Types.ObjectId.isValid(deleteId)) throw new Error("ID không hợp lệ");

					await userProvider.validateUserId(req.user.id as string);
					const existingItem = await provider.getById(deleteId);
					if (!existingItem) throw new Error("File không tồn tại");

					await deleteFile(existingItem.file_path);

					const data = await provider.delete(deleteId);

					return res.sendOk({
						message: "Xóa file thành công",
						data: data,
					});
				} catch (error) {
					logger.logAsync(METHOD_NAME, SOURCE, error, null);
					return res.sendError({ err: error });
				}
			},
		},
	};
};
