import nconf from "nconf";
import { JwtPayload, verify } from "jsonwebtoken";
import { Req, Res } from "#services/interfaces/iapi";
import { NextFunction } from "express";
import { MeUError } from "../dto/MeUErrorDTO";

export default function (req: Req, res: Res, next: NextFunction) {
	try {
		const bearerHeader = req.header("Authorization");

		const [_bearer, token] = bearerHeader.split(" ");
		if (!token) return res.sendError({ err: new Error("Not authorization") });

		const verified: JwtPayload = <JwtPayload>verify(token, nconf.get("JWT:Secret"));
		req.user = verified;
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
		const verified: JwtPayload = <JwtPayload>verify(token, nconf.get("JWT:Secret"));
		req.user = verified;
		return;
	} catch (error) {
		throw new MeUError(401, "API", error);
	}
};
