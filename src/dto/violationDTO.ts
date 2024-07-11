import constants from "../constants/index";
export class ViolationDTO {
	private code: number;
	private message: string;
	private action: any;
	constructor(code: number, message: string, action: any = null) {
		this.code = code;
		this.message = message;
		this.action = action;
	}
}

export function getMessage(errorCode: number, errorType: string) {
	// Catch this exception and proceed to get the defaut error message
	let message: string;
	try {
		try {
			message = constants.ErrorConfiguration[errorType][errorCode];
		} catch (ex) {
			message = constants.ErrorConfiguration[constants.ERROR_TYPE.API][errorCode];
		}
	} catch (ex) {
		message = constants.ErrorConfiguration[constants.ERROR_TYPE.API][constants.DEFAULT_ERROR_CODE];
	}

	return message;
}
