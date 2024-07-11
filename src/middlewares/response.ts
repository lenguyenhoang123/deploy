import { NextFunction } from "express";
import { Req, Res } from "#services/interfaces/iapi";
import { ViolationDTO, getMessage } from "../dto/violationDTO";
import { MeUError } from "../dto/MeUErrorDTO";
import LoggingService from "../services/file-system-handlers/logService";
import responseDTO from "../dto/apiResponseDTO";
import constants from "../constants/index";

export default (_req: Req, res: Res, next: NextFunction) => {
	const logger = new LoggingService();
	res.sendErrorStatus = function ({
		status,
		message = constants.DEFAULT_ERROR_MESSAGE,
		message_en = constants.DEFAULT_ERROR_MESSAGE_EN,
		err,
	}: {
		status: number;
		message?: string;
		message_en?: string;
		err?: Error | MeUError;
	}) {
		let SOURCE = "ERROR STATUS",
			violationMess: string = null,
			violations = [];

		if (err instanceof MeUError) {
			violationMess = getMessage(err.errorCode, err.errorType);
			SOURCE += " " + err.errorType;
			if (violationMess) violations.push(new ViolationDTO(err.errorCode, violationMess, err.errorData));
		}

		if (violations.length == 0)
			violations.push(
				new ViolationDTO(
					constants.DEFAULT_ERROR_CODE,
					getMessage(constants.DEFAULT_ERROR_CODE, constants.ERROR_TYPE.API),
				),
			);

		logger.logErrorAsync(SOURCE, err, null);

		res.status(status).json(responseDTO({ data: null, message, message_en, violations }));
	};

	res.sendError = function ({ err }: { err: MeUError }) {
		const violationMess = err.message;
		const violations = [];
		const SOURCE = "ERROR ";
		if (violationMess) {
			violations.push(new ViolationDTO(err.errorCode, violationMess));
		}

		if (violations.length == 0) {
			violations.push(
				new ViolationDTO(
					constants.DEFAULT_ERROR_CODE,
					getMessage(constants.DEFAULT_ERROR_CODE, constants.ERROR_TYPE.API),
				),
			);
		}
		logger.logErrorAsync(SOURCE, err, null).catch((err) => console.log(err));

		res.status(500).json(
			responseDTO({
				data: null,
				message: constants.DEFAULT_ERROR_MESSAGE,
				message_en: constants.DEFAULT_ERROR_MESSAGE_EN,
				violations,
			}),
		);
	};

	res.sendOk = function ({
		data,
		message = constants.DEFAULT_SUCCESS_MESSAGE,
		message_en = constants.DEFAULT_SUCCESS_MESSAGE_EN,
		statusCode,
	}: {
		data: unknown;
		message?: string;
		message_en?: string;
		statusCode?: number;
	}) {
		res.status(statusCode ?? 200).json(responseDTO({ data, message, message_en }));
	};
	next();
};
