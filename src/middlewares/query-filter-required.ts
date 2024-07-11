import { MeUError } from "#dto/MeUErrorDTO";
import { Req, Res } from "#services/interfaces/iapi";
import { NextFunction } from "express";

/**
 *
 * @param requiredFilters
 * @returns
 * @description Middleware to check if required filters are present in the request - Requires running after query-filter middleware
 * @example
 * ```ts
 * app.get("/api/v1.0/notifications", queryFilter<T>, queryFilterRequired(["currentPage", "pageSize"]), controller.get);
 */
export default function (requiredFilters: string[]) {
	return (req: Req, res: Res, next: NextFunction) => {
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
