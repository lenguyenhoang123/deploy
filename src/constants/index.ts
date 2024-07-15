import { readFileSync } from "fs";
import { resolve } from "path";
import { root } from "../root";

export default {
	// Default consts
	DEFAULT_ERROR_CODE: -999,
	DEFAULT_ERROR_MESSAGE: "Đã có lỗi xảy ra, vui lòng thử lại sau",
	DEFAULT_ERROR_MESSAGE_EN: "There has been a problem with the system, please try again later",
	DEFAULT_SUCCESS_MESSAGE: "Thành công",
	DEFAULT_SUCCESS_MESSAGE_EN: "Success",
	// Log
	LOG_CHANNEL_TYPE: "centerAPI",
	LOG_TYPE: "log",
	LOG_INFO_CATEGORY: "info",
	LOG_ERROR_CATEGORY: "error",
	LOG_TRANS_CATEGORY: "trans",
	LOG_TRACE_CATEGORY: "trace",
	LOG_DB_CATEGORY: "db",
	// Paths
	BUILD_PATH: "dist",
	LOG_PATH: "logs",
	STORE_PATH: "storage",
	//   Swagger
	SWAGGER_ROUTER: "/swagger/index",
	SWAGGER_OUTPUT: "/swagger/swagger-output.json",

	MIME_TYPES: {
		IMAGE: ["image/jpeg", "image/png", "image/gif"],
		VIDEO: [
			"video/x-flv",
			"video/mp4",
			"application/x-mpegURL",
			"video/MP2T",
			"video/3gpp",
			"video/quicktime",
			"video/x-msvideo",
			"video/x-ms-wmv",
		],
	},

	ERROR_TYPE: {
		API: "API",
	},
	ErrorConfiguration: {
		API: {
			[-999]: "There seems to be a problem performing your action, please try again.",
			[104]: "The voucher transaction is not found.",
			[401]: "Unauthorize",
			[400]: "Validation Error",
			[302]: "Cập nhật tài khoản",
		},
	},

	EMAIL: {
		register: (email: string, otp: string) => {
			const // Result
				subject = `Phòng ban Sở hữu Trí tuệ - Mã xác minh đăng ký`,
				html = readFileSync(resolve(root, "src/templates/email", "registerOTP.html"), "utf-8")
					.replace("{{ email }}", email)
					.replace("{{ otp }}", otp);

			return { subject, html };
		},
	},
};
