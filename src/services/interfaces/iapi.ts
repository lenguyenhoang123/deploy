import { MeUError } from "#dto/MeUErrorDTO";
import { SequelizeApiPaginatePayload } from "#services/database/sequelize-api-paginate";
import { IncomingHttpHeaders } from "http";
import { JwtPayload } from "jsonwebtoken";
import { Request, Response } from "express";

export interface Req<T = any> extends Request {
	user?: { id?: string } & JwtPayload;
	payload?: SequelizeApiPaginatePayload<T>;
	headers: IncomingHttpHeaders & { isadmin?: string };
	[key: string]: unknown;
}

export interface Res extends Response {
	sendErrorStatus?: ({
		status,
		message,
		message_en,
		err,
	}: {
		status: number;
		message: string;
		message_en: string;
		err?: Error | MeUError;
	}) => void;
	sendOk?: ({
		data,
		message,
		message_en,
		statusCode,
	}: {
		data: any;
		message?: string;
		message_en?: string;
		statusCode?: number;
	}) => void;
	sendError?: ({ err }: { err: Error | MeUError }) => void;
}
