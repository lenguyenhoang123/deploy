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
	...validatePassword(),
	body("profile").optional().isObject().withMessage("Profile phải là một object"),
];

export const validateUpdateUserInfo = () => [
	...validateFirstName(),
	...validateMiddleName(),
	...validateLastName(),
	body("profile").optional().isObject().withMessage("Profile phải là một object"),
];

export const validateUpdateWebsiteConfig = () => [
	body("email").optional().isEmail().withMessage("Email không hợp lệ"),
	body("logo").optional().isMongoId().withMessage("Logo phải là một ID hợp lệ"),
	body("banner").optional().isMongoId().withMessage("Banner phải là một ID hợp lệ"),
	body("banners")
		.optional()
		.isArray()
		.withMessage("Banners phải là một mảng")
		.custom((value: any[]) => {
			if (!Array.isArray(value)) return true;
			for (const id of value) {
				if (!/^[0-9a-fA-F]{24}$/.test(id)) {
					throw new Error(`ID banner ${id} không hợp lệ`);
				}
			}
			return true;
		}),
	body("guide_video").optional().isMongoId().withMessage("Guide video phải là một ID hợp lệ"),
	body("profile_schema")
		.optional()
		.isArray()
		.withMessage("Profile schema phải là một mảng")
		.custom((value: any[]) => {
			if (!Array.isArray(value)) return true;
			for (const field of value) {
				if (!field.key || typeof field.key !== "string") {
					throw new Error("Mỗi field trong profile_schema phải có key là chuỗi ký tự");
				}
				if (!field.label || typeof field.label !== "string") {
					throw new Error("Mỗi field trong profile_schema phải có label là chuỗi ký tự");
				}
				if (!field.type || !["text", "date", "select", "number"].includes(field.type)) {
					throw new Error("Mỗi field trong profile_schema phải có type là text, date, select hoặc number");
				}
			}
			return true;
		}),
	body("exam_rules").optional().isObject().withMessage("Exam rules phải là một object"),
	body("unit_schema").optional().isObject().withMessage("Unit schema phải là một object"),
];

export const validateEmail = () => [
	body("email", "Email không được để trống").notEmpty(),
	body("email", "Email không hợp lệ").isEmail(),
];

export const validateFirstName = () => [
	body("first_name", "Tên không được để trống").notEmpty(),
	body("first_name", "Tên không hợp lệ").isAlpha("vi-VN"),
	body("first_name", "Tên không được ít hơn 3 và nhiều hơn 20 ký tự").isLength({ min:3,max: 20 }),
];

export const validateMiddleName = () => [body("middle_name", "Tên lót không hợp lệ").matches(/^[a-zA-ZÀ-ỹ\s]*$/)];

export const validateLastName = () => [
	body("last_name", "Họ không được để trống").notEmpty(),
	body("last_name", "Họ không hợp lệ").isAlpha("vi-VN"),
	body("last_name", "Họ không được ít hơn 3 và nhiều hơn 20 ký tự").isLength({ min:3,max: 20 }),
];

export const validatePhone = () => [
	body("phone", "Số điện thoại không được để trống").notEmpty(),
	body("phone", "Số điện thoại không hợp lệ").isMobilePhone("vi-VN"),
	body("phone")
		.isLength({ min: 10, max: 11 })
		.withMessage("Số điện thoại phải có 10 hoặc 11 chữ số")
		.isNumeric()
		.withMessage("Số điện thoại chỉ được chứa số"),
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

	body("files").optional().isArray().withMessage("Danh sách file phải là một mảng"),

	body("answers")
		.isArray()
		.withMessage("Đáp án phải là một mảng")
		.custom((value, { req }) => {
			// Skip validation for essay questions
			if (req.body.type === "ESSAY") return true;
			// For multiple choice, require 2-4 answers
			return value.length >= 2 && value.length <= 4;
		})
		.withMessage("Mỗi câu hỏi trắc nghiệm phải có từ 2 đến 4 đáp án")
		.custom((answers: any[], { req }) => {
			// Skip validation for essay questions
			if (req.body.type === "ESSAY") return true;
			return answers.every(
				(answer) => answer.value && typeof answer.value === "string" && typeof answer.is_correct === "boolean",
			);
		})
		.withMessage("Mỗi đáp án phải có giá trị (chuỗi ký tự), is_correct (boolean)")
		.custom((answers: any[], { req }) => {
			// Skip validation for essay questions
			if (req.body.type === "ESSAY") return true;
			const correctAnswers = answers.filter((answer) => answer.is_correct);
			return correctAnswers.length === 1;
		})
		.withMessage("Mỗi câu trắc nghiệm chỉ có 1 đáp án đúng"),
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
		.optional()
		.isISO8601()
		.withMessage("Thời gian bắt đầu phải là định dạng ngày giờ hợp lệ"),

	body("submit_time")
		.optional()
		.isISO8601()
		.withMessage("Thời gian nộp bài phải là định dạng ngày giờ hợp lệ"),

	body("attempt_number")
		.optional()
		.isInt({ min: 1, max: 5 })
		.withMessage("Số lượt thi phải từ 1 đến 5"),

	body("answers")
		.isArray()
		.withMessage("Danh sách câu trả lời phải là một mảng")
		.custom((answers: any[]) => {
			if (!Array.isArray(answers)) {
				throw new Error("Danh sách câu trả lời phải là một mảng");
			}
			// Allow empty answers array - user can submit without answering
			if (answers.length === 0) {
				return true;
			}
			for (const answer of answers) {
				// Validate question_id
				if (!answer.question_id) {
					throw new Error("Mỗi câu trả lời phải có question_id");
				}
				if (!/^[0-9a-fA-F]{24}$/.test(answer.question_id)) {
					throw new Error(`question_id ${answer.question_id} không hợp lệ`);
				}
				// Validate answer format - must have either user_answer or text_answer
				if (!answer.user_answer && !answer.text_answer) {
					throw new Error("Mỗi câu trả lời phải có user_answer (trắc nghiệm) hoặc text_answer (tự luận)");
				}
				// Validate user_answer format (if provided)
				if (answer.user_answer && !/^[0-9a-fA-F]{24}$/.test(answer.user_answer)) {
					throw new Error(`user_answer ${answer.user_answer} không hợp lệ`);
				}
				// Validate text_answer format (if provided)
				if (answer.text_answer && typeof answer.text_answer !== "string") {
					throw new Error("text_answer phải là chuỗi ký tự");
				}
			}
			return true;
		}),
];

// Validate profile fields against profile_schema from WebsiteConfig
export function validateProfile(profile: Record<string, any> | undefined, profileSchema: any[]): string | null {
	if (!profile) return "Vui lòng cung cấp thông tin profile";

	for (const field of profileSchema) {
		const value = profile[field.key];

		// Check required fields
		if (field.required && (value === undefined || value === null || value === "")) {
			return `${field.label} là bắt buộc`;
		}

		// Skip validation if value is empty and not required
		if (!value && !field.required) continue;

		// Special validation for identity_number (CCCD/CMND)
		if (field.key === "identity_number" && value) {
			const idStr = String(value).trim();
			if (!/^\d+$/.test(idStr)) {
				return `${field.label} chỉ được chứa số`;
			}
			if (idStr.length !== 9 && idStr.length !== 12) {
				return `${field.label} phải có 9 số (CMND cũ) hoặc 12 số (CCCD)`;
			}
			continue;
		}

		// Type validation
		switch (field.type) {
			case "text":
				if (typeof value !== "string") return `${field.label} phải là chuỗi ký tự`;
				break;
			case "number":
				if (typeof value !== "number" && isNaN(Number(value))) {
					return `${field.label} phải là số`;
				}
				break;
			case "date":
				if (!Date.parse(value)) return `${field.label} phải là ngày hợp lệ`;
				break;
			case "select":
				if (field.options && !field.options.includes(value)) {
					return `${field.label} phải là một trong các giá trị: ${field.options.join(", ")}`;
				}
				break;
		}
	}

	return null;
}

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
