import { MeUError } from "#dto/MeUErrorDTO";
import { Req, Res } from "#services/interfaces/iapi";
import { NextFunction } from "express";
import { modifyFilterString } from "#services/database/query-string";

export default function <T = unknown>(req: Req, res: Res, next: NextFunction) {
  try {
    req.payload = {};
    if (req.query.filters)
      req.payload.where = modifyFilterString<T>(req.query.filters as string);
    if (req.query.currentPage)
      req.payload.currentPage = parseInt(req.query.currentPage as string);
    if (req.query.pageSize)
      req.payload.pageSize = parseInt(req.query.pageSize as string);
    if (req.query.attributes)
      req.payload.attributes = (req.query.attributes as string).split(",");
    if (req.query.sortField && req.query.sortOrder) {
      req.payload.sortField = req.query.sortField as string;
      req.payload.sortOrder = req.query.sortOrder as string;
    }
    next();
  } catch (err) {
    return res.sendErrorStatus({
      status: 500,
      message: "Đã có lỗi xảy ra",
      message_en: "There has been an error",
      err: new MeUError(500, "API", err),
    });
  }
}
