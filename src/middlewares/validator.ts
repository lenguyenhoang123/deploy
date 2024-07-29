import { Req, Res } from "#services/interfaces/iapi";
import { NextFunction } from "express";
import { MeUError } from "../dto/MeUErrorDTO";
import {
	validateEmail,
	validatePassword,
	validateRegisterUser,
	validateLogin,
	validateQuestionBank,
	validateExam,
	validateUpdateMyInfo,
} from "#services/data-handlers/validatorService";
import { validationResult, ContextRunner } from "express-validator";

export const validate = (validations: ContextRunner[]) => async (req: Req, res: Res, next: NextFunction) => {
	await Promise.all(validations.map((valdation) => valdation.run(req)));

	const errors = validationResult(req);
	if (errors.isEmpty()) return next();

	return res.sendErrorStatus({
		status: 400,
		message: "Đã có lỗi khi nhập dữ liệu, vui lòng kiểm tra lại",
		message_en: "There has been an error when filling in data, please try again",
		err: new MeUError(
			400,
			"Violation Error",
			errors.array({ onlyFirstError: true }).map(({ type, ...rest }) => ({ ...rest })),
		),
	});
};

export const validateEmailEntry = validate(validateEmail());
export const validatePasswordEntry = validate(validatePassword());
export const validateRegister = validate(validateRegisterUser());
export const validateLoginEntry = validate(validateLogin());
export const validateQuestionBankEntry = validate(validateQuestionBank());
export const validateExamEntry = validate(validateExam());
export const validateUpdateMyInfoEntry = validate(validateUpdateMyInfo());

export default validate;

// LEGACY: Message error only
// ...errors.array().reduce(
//   (acc, el) => ({
//     message: acc.message
//       ? `${acc.message} | ${el.msg["vi"] ?? el.msg}`
//       : el.msg["vi"] ?? el.msg,
//     message_en: acc.message_en
//       ? `${acc.message_en} | ${el.msg["en"] ?? el.msg}`
//       : el.msg["en"] ?? el.msg,
//   }),
//   {
//     message: null,
//     message_en: null,
//   }
// )
