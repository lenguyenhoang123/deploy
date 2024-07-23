import { check, body } from "express-validator";

export const validateLogin = () => {
	return [...validateEmail(), ...validatePassword()];
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
	body("email", "Email không được để trống").trim().not().isEmpty().matches(/\S+/),
	body("email", "Email không hợp lệ").isEmail(),
];

export const validateFirstName = () => [
	body("first_name", "Tên không được để trống").trim().not().isEmpty().matches(/\S+/),
	body("first_name", "Tên không hợp lệ").matches(/^[a-zA-ZÀ-ỹ\s]+$/),
];

export const validateMiddleName = () => [body("middle_name", "Tên lót không hợp lệ").matches(/^[a-zA-ZÀ-ỹ\s]*$/)];

export const validateLastName = () => [
	body("last_name", "Họ không được để trống").trim().not().isEmpty().matches(/\S+/),
	body("last_name", "Họ không hợp lệ").matches(/^[a-zA-ZÀ-ỹ\s]+$/),
];

export const validatePhone = () => [
	body("phone", "Số điện thoại không được để trống").trim().not().isEmpty().matches(/\S+/),
	body("phone", "Số điện thoại không hợp lệ").isMobilePhone("vi-VN"),
];

export const validateUnit = () => [
	body("unit.district", "Quận không được để trống").trim().not().isEmpty().matches(/\S+/),
	body("unit.ward", "Phường/ xã không được để trống").trim().not().isEmpty().matches(/\S+/),
];

export const validatePassword = () => [
	body("password", "Mật khẩu không được để trống").trim().not().isEmpty().matches(/\S+/),
	body("password", "Mật khẩu không thể chứa khoảng trắng").not().contains(" "),
	body("password", "Mật khẩu cần ít nhất 8 ký tự").isLength({ min: 8 }),
];

export default {
	validateEmail,
	validateRegisterUser,
	validateLogin,
	validatePassword,
};
