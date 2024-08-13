import nconf from "nconf";
import { verify } from "jsonwebtoken";
import { AuthPayload, Req, Res } from "#services/interfaces/iapi";
import { NextFunction } from "express";
import { MeUError } from "../dto/MeUErrorDTO";

export default function (req: Req, res: Res, next: NextFunction) {
	try {
		const bearerHeader = req.header("Authorization");

		const [_bearer, token] = bearerHeader.split(" ");
		if (!token) return res.sendError({ err: new Error("Not authorization") });

		req.user = <AuthPayload>verify(token, nconf.get("JWT:Secret"));
		next();
	} catch (err) {
		return res.sendErrorStatus({
			status: 401,
			message: "Khoá không hợp lệ",
			message_en: "Invalid token",
			err: new MeUError(401, "API", err),
		});
	}
}

export const verifyToken = async (req: Req) => {
	try {
		const bearerHeader = req.header("Authorization");
		const [_bearer, token] = bearerHeader.split(" ");
		if (!token) throw new Error("Not authorization");
		const verified = <AuthPayload>verify(token, nconf.get("JWT:Secret"));
		req.user = verified;
		return;
	} catch (error) {
		throw new MeUError(401, "API", error);
	}
};

export const verifyAdmin = (req: Req, res: Res, next: NextFunction) => {
	try {
		if (!req.user.isAdmin) {
			throw new Error("User is not an admin");
		}
		next();
	} catch (err) {
		return res.status(403).send({
			status: 403,
			message: "Không có quyền truy cập",
			message_en: "Access denied",
			err: new MeUError(403, "API", err.message),
		});
	}
};
