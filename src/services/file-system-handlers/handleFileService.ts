import fs from "fs";
import path from "path";
import { promisify } from "util";
import { fork } from "child_process";
import nconf from "nconf";

const unlinkAsync = promisify(fs.unlink);
const rmdirAsync = promisify(fs.rmdir);

const isDirectoryEmpty = (dirPath: string): boolean => {
	const files = fs.readdirSync(dirPath);
	return files.length === 0;
};

function convertSlashes(inputPath: string, toForwardSlash: boolean = true): string {
	return toForwardSlash ? inputPath.replace(/\\/g, "/") : inputPath.replace(/\//g, "\\");
}

const extractFilePath = (fullFilePath: string): { storagePath: string; relativePath: string } => {
	const storagePath = path.resolve(nconf.get("Storage"));

	if (!fullFilePath.startsWith(storagePath)) {
		throw new Error("Đường dẫn không chứa storage path");
	}

	const relativePath = path.relative(storagePath, fullFilePath);

	return { storagePath, relativePath };
};

export const getRelativePathToSave = (fullFilePath: string): string => {
	return "/" + convertSlashes(extractFilePath(fullFilePath).relativePath);
};

const deleteEmptyDirectories = async (dirPath: string): Promise<void> => {
	try {
		if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
			const parentDir = path.dirname(dirPath);
			if (isDirectoryEmpty(dirPath)) {
				await rmdirAsync(dirPath);
				if (parentDir !== path.resolve(".")) {
					await deleteEmptyDirectories(parentDir);
				}
			}
		}
	} catch (error) {
		console.error(`Đã có lỗi xảy ra khi xóa thư mục: ${error.message}`);
		throw error;
	}
};

export const deleteFile = async (relativePath: string): Promise<void> => {
	try {
		const absolutePath = path.resolve(nconf.get("Storage")) + relativePath;
		if (!fs.existsSync(absolutePath)) throw new Error(`Không tìm thấy file ở đường dẫn: ${absolutePath}`);
		await unlinkAsync(absolutePath);

		// Delete empty directories after deleting the file
		const dirPath = path.dirname(absolutePath);
		await deleteEmptyDirectories(dirPath);
	} catch (error) {
		console.error(`Đã có lỗi xảy ra khi xóa file: ${error.message}`);
		throw error;
	}
};

export const formatFileSize = (sizeInBytes: number): string => {
	const units = ["Bytes", "KB", "MB", "GB", "TB"];
	let index = 0;
	let fileSize = sizeInBytes;

	while (fileSize >= 1024 && index < units.length - 1) {
		fileSize /= 1024;
		index++;
	}

	return `${fileSize.toFixed(2)} ${units[index]}`;
};

export const wrapCompression = (
	/** Path to the compression module */
	modulePath: string,
	/** Size to be compressed, between: desktop | mobile | tablet */
	compressSize: string,
	/** Type of file, between: IMAGE | VIDEO */
	compressType: string,
	/** File collected from multer middleware */
	file: Express.Multer.File,
	/** Return options */
	fileReturnOptions: {
		fileName?: string;
		contentType?: string;
		originalPath?: string;
	},
) => {
	return new Promise<void>((resolve, reject) => {
		if (!fs.existsSync(modulePath)) {
			//   self.logger.logAsync(METHOD_NAME, SOURCE, compressFileService, null);
			return reject(new Error("Missing compression service"));
		}
		const child = fork(modulePath);
		child.on("error", (err) => reject(new Error(err.message)));
		child.send({ compressType, file, compressSize });
		child.on("message", (message: { [key: string]: string | number }) => {
			if (message.statusCode == 500) reject(new Error(<string>message.text));
			else {
				for (var [key, value] of Object.entries(message.path)) fileReturnOptions[key] = value;
				resolve();
			}
		});
	});
};
