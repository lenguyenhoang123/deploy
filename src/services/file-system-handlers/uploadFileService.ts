import fs from "fs";
import multer from "multer";
import nconf from "nconf";
import constants from "#constants/index";
import path from "path";
import { promisify } from "util";
import { Req } from "../data-handlers/interfaceService";

const mimeTypes = constants.MIME_TYPES;
const fileTypeFn = (type = "DEFAULT") => {
  switch (type) {
    case "IMAGE":
      return "images";
    case "VIDEO":
      return "videos";
    default:
      return "files";
  }
};

const storage = multer.diskStorage({
    destination: function (
      req: Req,
      file: Express.Multer.File,
      cb: (arg0: null, arg1: string) => void
    ) {
      const // Const
        fileType = Object.keys(mimeTypes).find((key) =>
          mimeTypes[key].includes(file.mimetype)
        ),
        storagePath = path.resolve(
          nconf.get("Storage"),
          fileTypeFn(fileType),
          <string>req.imagePath ?? ""
        );
      fs.mkdirSync(storagePath, { recursive: true });
      cb(null, storagePath);
    },
    filename: function (
      req: Req,
      file: { fieldname: string; originalname: string },
      cb: (arg0: null, arg1: string) => void
    ) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        `${file.fieldname}-${uniqueSuffix}${req.extendName ?? ""}${path.extname(
          file.originalname
        )}`
      );
    },
  }),
  upload = multer({ storage: storage }).single("file");

export default promisify(upload);
