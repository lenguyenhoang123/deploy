import { body, ValidationChain } from "express-validator";
import { DifficultyLevels } from "#models/questionBank";

export const validateLogin = () => {
	return [...validateEmail(), ...validatePassword()];
};

export const validateVerifyOTP = () => {
	return [...validateEmail(), ...validateOTP()];
};

export const validateRegisterUser = () => [
	...validateEmail(),
	...validateFirstName(),
	...validateMiddleName(),
	...validateLastName(),
	...validatePhone(),
	...validateUnit(),
	...validatePassword(),
];

export const validateUpdateUserInfo = () => [
	...validateFirstName(),
	...validateMiddleName(),
	...validateLastName(),
	...validateUnit(),
];

export const validateUpdateWebsiteConfig = () => [body("email", "Email không hợp lệ").isEmail()];

export const validateEmail = () => [
	body("email", "Email không được để trống").notEmpty(),
	body("email", "Email không hợp lệ").isEmail(),
];

export const validateFirstName = () => [
	body("first_name", "Tên không được để trống").notEmpty(),
	body("first_name", "Tên không hợp lệ").isAlpha("vi-VN"),
];

export const validateMiddleName = () => [body("middle_name", "Tên lót không hợp lệ").matches(/^[a-zA-ZÀ-ỹ\s]*$/)];

export const validateLastName = () => [
	body("last_name", "Họ không được để trống").notEmpty(),
	body("last_name", "Họ không hợp lệ").isAlpha("vi-VN"),
];

export const validatePhone = () => [
	body("phone", "Số điện thoại không được để trống").notEmpty(),
	body("phone", "Số điện thoại không hợp lệ").isMobilePhone("vi-VN"),
];

export const validateUnit = () => [
	body("unit.district", "Quận không được để trống").notEmpty(),
	body("unit.ward", "Phường/ xã không được để trống").notEmpty(),
];

export const validatePassword = () => [
	body("password", "Mật khẩu không được để trống").notEmpty(),
	body("password", "Mật khẩu không thể chứa khoảng trắng").not().contains(" "),
	body("password", "Mật khẩu cần ít nhất 8 ký tự").isLength({ min: 8 }),
];

export const validateOTP = () => [
	body("otp")
		.notEmpty()
		.withMessage("OTP không được để trống.")
		.isNumeric()
		.isLength({ min: 6, max: 6 })
		.withMessage("OTP phải bao gồm 6 chữ số."),
];

export const validateQuestionBank = () => [
	body("name")
		.isString()
		.withMessage("Tên câu hỏi phải là một chuỗi ký tự")
		.notEmpty()
		.withMessage("Tên không được để trống"),

	body("level")
		.isString()
		.withMessage("Độ khó phải là một chuỗi ký tự")
		.isIn(Object.values(DifficultyLevels))
		.withMessage(`Độ khó phải là một trong các giá trị: ${Object.values(DifficultyLevels).join(", ")}`)
		.notEmpty()
		.withMessage("Độ khó không được để trống"),

	body("answers")
		.isArray()
		.withMessage("Đáp án phải là một mảng")
		.custom((value) => value.length >= 4)
		.withMessage("Phải có ít nhất 4 đáp án")
		.custom((answers: any[]) => {
			return answers.every(
				(answer) => answer.value && typeof answer.value === "string" && typeof answer.is_correct === "boolean",
			);
		})
		.withMessage("Mỗi đáp án phải có giá trị (chuỗi ký tự), is_correct (boolean)")
		.custom((answers: any[]) => {
			const correctAnswers = answers.filter((answer) => answer.is_correct);
			return correctAnswers.length === 1;
		})
		.withMessage("Mỗi câu hỏi chỉ có 1 đáp án đúng"),
];

export const validateExam = () => [
	body("name")
		.isString()
		.withMessage("Tên kỳ thi phải là một chuỗi ký tự")
		.notEmpty()
		.withMessage("Tên kỳ thi không được để trống"),

	body("description").optional().isString().withMessage("Mô tả kỳ thi phải là một chuỗi ký tự"),

	body("start_time")
		.isISO8601()
		.withMessage("Thời gian bắt đầu phải là định dạng ngày giờ hợp lệ")
		.custom((value) => {
			if (new Date(value) <= new Date())
				throw new Error("Không thể tạo kỳ thi đã hoặc đang diễn ra. Vui lòng chọn lại thời gian bắt đầu");

			return true;
		}),

	,
	body("end_time")
		.isISO8601()
		.withMessage("Thời gian kết thúc phải là định dạng ngày giờ hợp lệ")
		.custom((value, { req }) => {
			if (new Date(value) <= new Date(req.body.start_time)) {
				throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu");
			}
			return true;
		}),

	body("allowed_time").isInt({ min: 1 }).withMessage("Thời gian làm bài phải là một số nguyên dương"),
];

export const validateSubmitExam = () => [
	body("start_time")
		.isISO8601()
		.withMessage("Thời gian bắt đầu phải là định dạng ngày giờ hợp lệ")
		.notEmpty()
		.withMessage("Thời gian bắt đầu không được để trống"),

	body("submit_time")
		.isISO8601()
		.withMessage("Thời gian nộp bài phải là định dạng ngày giờ hợp lệ")
		.notEmpty()
		.withMessage("Thời gian nộp bài không được để trống")
		.custom((submit_time, { req }) => {
			if (new Date(submit_time) <= new Date(req.body.start_time)) {
				throw new Error("Thời gian nộp bài phải sau thời gian bắt đầu");
			}
			return true;
		}),

	body("answers")
		.notEmpty()
		.withMessage("Danh sách câu trả lời không được để trống")
		.isArray()
		.withMessage("Danh sách câu trả lời phải là một mảng"),
];

export default {
	validateVerifyOTP,
	validateEmail,
	validateRegisterUser,
	validateLogin,
	validatePassword,
	validateUpdateUserInfo,
	validateUpdateWebsiteConfig,
	validateSubmitExam,
};
