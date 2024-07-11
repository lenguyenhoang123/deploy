export default ({
	data,
	message,
	message_en,
	violations,
}: {
	data: any | null;
	message?: string;
	message_en?: string;
	violations?: any;
}): object => ({
	message: !message ? null : message,
	message_en: !message_en ? null : message_en,
	responseData: !data ? null : data,
	status: violations === undefined || violations === null || violations.length == 0 ? "success" : "fail",
	timeStamp: new Date().toISOString().replace(/T/, " ").replace(/\..+/, ""),
	violations: !violations ? null : violations,
});
