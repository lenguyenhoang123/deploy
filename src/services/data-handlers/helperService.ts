import { existsSync } from "fs";
import { fork } from "child_process";
import LoggingService from "../file-system-handlers/logService";

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
  }
) => {
  return new Promise<void>((resolve, reject) => {
    if (!existsSync(modulePath)) {
      const logger = new LoggingService();
      logger.logErrorAsync(
        "wrapCompression",
        new Error("Module path not found"),
        null
      );
      return reject(new Error("Missing compression service"));
    }
    const child = fork(modulePath);
    child.on("error", (err) => reject(new Error(err.message)));
    child.send({ compressType, file, compressSize });
    child.on("message", (message: { [key: string]: string | number }) => {
      if (message.statusCode == 500) reject(new Error(<string>message.text));
      else {
        for (const [key, value] of Object.entries(message.path))
          fileReturnOptions[key] = value;
        resolve();
      }
    });
  });
};

export function getBoolean(value: unknown) {
  switch (value) {
    case true:
    case "true":
    case 1:
    case "1":
    case "on":
    case "yes":
      return true;
    default:
      return false;
  }
}

export default {
  wrapCompression,
  getBoolean,
};
