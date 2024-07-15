import { MeUError } from "#dto/MeUErrorDTO";
import { QueryReq, Res } from "#services/interfaces/iapi";
import { NextFunction } from "express";
import { modifyFilterString } from "#services/database/query-string";

export function queryFilter<T = unknown>(req: QueryReq, res: Res, next: NextFunction) {
	try {
		req.payload = {};
		if (req.query.filters) req.payload.where = modifyFilterString<T>(req.query.filters);
		if (req.query.currentPage) req.payload.currentPage = parseInt(req.query.currentPage);
		if (req.query.pageSize) req.payload.pageSize = parseInt(req.query.pageSize);
		if (req.query.attributes) req.payload.attributes = req.query.attributes.split(",");
		if (req.query.sortField && req.query.sortOrder) {
			req.payload.sortField = req.query.sortField;
			req.payload.sortOrder = req.query.sortOrder;
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

/**
 *
 * @param requiredFilters
 * @returns
 * @description Middleware to check if required filters are present in the request - Requires running after query-filter middleware
 * @example
 * ```ts
 * app.get("/api/v1.0/notifications", queryFilter<T>, queryFilterRequired(["currentPage", "pageSize"]), controller.get);
 */
export function requiredFilters(requiredFilters: string[]) {
	return (req: QueryReq, res: Res, next: NextFunction) => {
		try {
			for (const filter of requiredFilters) {
				if (!req.payload[filter]) {
					throw new MeUError(400, "API", `Missing required filter.`);
				}
			}
			next();
		} catch (err) {
			return res.sendErrorStatus({
				status: err instanceof MeUError ? err.errorCode : 500,
				message: "Đã có lỗi xảy ra",
				message_en: err instanceof MeUError ? err.errorData.toString() : "There has been an error",
				err: err instanceof MeUError ? err : new MeUError(500, "API", err),
			});
		}
	};
}
