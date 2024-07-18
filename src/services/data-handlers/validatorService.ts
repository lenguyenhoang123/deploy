import { check, body } from "express-validator";

export const validateLogin = () => {
	return [
		check("email", "Email không được để trống").not().isEmpty(),
		check("email", "Email không hợp lệ").isEmail(),

		check("password", "Mật khẩu ít nhất 6 ký tự").isLength({ min: 6 }),
		check("password", "Mật khẩu tối đa 19 ký tự").isLength({ max: 19 }),
	];
};

export const validateForgetPassword = () => {
	return [
		check("email", "Email không được để trống").not().isEmpty(),
		check("email", "Email không hợp lệ").isEmail(),
		check("email", "Email ít nhất 3 ký tự").isLength({ min: 3 }),
		check("email", "Email tối đa 50 ký tự").isLength({ max: 50 }),
	];
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

export const validateEmail = () => [
	body("email", "Email không được để trống").not().isEmpty(),
	body("email", "Email không hợp lệ").isEmail(),
];

export const validateFirstName = () => [
	body("first_name", "Tên không được để trống").not().isEmpty(),
	body("first_name", "Tên không hợp lệ").matches(/^[a-zA-ZÀ-ỹ\s]+$/),
];

export const validateMiddleName = () => [body("middle_name", "Tên lót không hợp lệ").matches(/^[a-zA-ZÀ-ỹ\s]+$/)];

export const validateLastName = () => [
	body("last_name", "Họ không được để trống").not().isEmpty(),
	body("last_name", "Họ không hợp lệ").matches(/^[a-zA-ZÀ-ỹ\s]+$/),
];

export const validatePhone = () => [
	body("phone", "Số điện thoại không được để trống").not().isEmpty(),
	body("phone", "Số điện thoại không hợp lệ").isMobilePhone("vi-VN"),
];

export const validateUnit = () => [
	body("unit.district", "Quận không được để trống").not().isEmpty(),
	body("unit.ward", "Phường/ xã không được để trống").not().isEmpty(),
];

export const validatePassword = () => [
	body("password", "Mật khẩu không được để trống").not().isEmpty(),
	body("password", "Mật khẩu không thể chứa khoảng trắng").not().contains(" "),
	body("password", "Mật khẩu cần ít nhất 8 ký tự").isLength({ min: 8 }),
];

export default {
	validateEmail,
	validateRegisterUser,
	validateLogin,
	validateForgetPassword,
};
