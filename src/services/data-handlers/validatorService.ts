import { check, body } from "express-validator";

export const validateEmail = () => [
  body("email", {
    vi: "Email không được để trống",
    en: "Email can not be empty",
  })
    .not()
    .isEmpty(),

  body("email", {
    vi: "Email không hợp lệ",
    en: "Email is invalid",
  }).isEmail(),
];

export const validateRegisterUser = () => {
  return [
    body("full_name", {
      vi: "Tên không được để trống",
      en: "Name can not be empty",
    })
      .not()
      .isEmpty(),

    body("phone", {
      vi: "Số điện thoại không được để trống",
      en: "Phone number can not be empty",
    })
      .not()
      .isEmpty(),
    body("phone", {
      vi: "Số điện thoại không hợp lệ",
      en: "Phone number is invalid",
    }).isMobilePhone("vi-VN"),

    body("password", {
      vi: "Mật khẩu không được để trống",
      en: "Password can not be empty",
    })
      .not()
      .isEmpty(),
    body("password", {
      vi: "Mật khẩu không thể chứa khoảng trắng",
      en: "Password can not contain spaces",
    })
      .not()
      .contains(" "),
    body("password", {
      vi: "Mật khẩu cần ít nhất 8 ký tự",
      en: "Password needs at least 8 characters",
    }).isLength({ min: 8 }),

    // check("re_password")
    //   .isLength({ min: 1 })
    //   .withMessage("Xác nhận mật khẩu bắt buộc nhập"),

    // check('birthday', 'Invalid birthday').isISO8601('yyyy-mm-dd'),
    //  check('password', 'password more than 6 degits').isLength({ min: 6 })
  ];
};

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

export default {
  validateEmail,
  validateRegisterUser,
  validateLogin,
  validateForgetPassword,
};
