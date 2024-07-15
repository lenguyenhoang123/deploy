import { MeUError } from "#dto/MeUErrorDTO";
import { IncomingHttpHeaders } from "http";
import { JwtPayload } from "jsonwebtoken";
import { Request, Response } from "express";
import { FilterQuery } from "mongoose";

export interface Req<ModelInterface = any, ModelMutationInterface = ModelInterface> extends Request {
	user?: AuthPayload;
	payload?: FilterQuery<ModelInterface>;
	headers: IncomingHttpHeaders & { isadmin?: string };
	body: ModelMutationInterface;
	[key: string]: unknown;
}

export interface QueryReq<CustomQueries = object> extends Req {
	query: {
		filters?: string;
		currentPage?: string;
		pageSize?: string;
		attributes?: string;
		sortField?: string;
		sortOrder?: string;
	} & CustomQueries;
}

export interface AuthPayload extends JwtPayload {
	id: string;
	isAdmin: boolean;
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

export interface RequestPayload<T> {
	where: FilterQuery<T>;
	currentPage: number;
	pageSize: number;
	attributes: string[];
	sortField: string;
	sortOrder: string;
}
