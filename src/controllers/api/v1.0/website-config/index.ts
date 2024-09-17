import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { validateUpdateWebsiteConfigEntry } from "#middlewares/validator";
import { WebsiteConfigProvider } from "#providers/websiteConfigProvider";
import { UserProvider } from "#providers/userProvider";
import { FileProvider } from "#providers/fileProvider";
import { MeUError } from "#dto/MeUErrorDTO";
import mongoose from "mongoose";

export default (_express: Application) => {
	const provider = new WebsiteConfigProvider();
	const userProvider = new UserProvider();
	const fileProvider = new FileProvider();
	return <Resource>{
		get: {
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 *  /website-config:
				 *   get:
				 *     tags: [WebsiteConfig]
				 *     description: Get Website Config
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *            schema:
				 *                $ref: '#/components/schemas/Response'
				 */

				try {
					let websiteConfig = await provider.getOne({
						where: { is_default: true },
						attributes: ["name", "phone", "email", "website", "address", "logo", "banner", "theme", "is_default"],
					});

					if (!websiteConfig) {
						const newInfo = {
							name: null,
							phone: null,
							email: null,
							website: null,
							address: null,
							logo: null,
							banner: null,
							theme: null,
							is_default: true,
						};
						websiteConfig = await provider.post({ ...newInfo });
					}

					const websiteConfigDetail = await websiteConfig.populate([
						{
							path: "logo",
							select: "file_name original_name mime_type file_type file_path size",
						},
						{
							path: "banner",
							select: "file_name original_name mime_type file_type file_path size",
						},
					]);

					const data = {
						name: websiteConfigDetail.name,
						phone: websiteConfigDetail.phone,
						email: websiteConfigDetail.email,
						website: websiteConfigDetail.website,
						address: websiteConfigDetail.address,
						logo: websiteConfigDetail.logo,
						banner: websiteConfigDetail.banner,
						theme: websiteConfigDetail.theme,
					};

					if (!data) throw new Error("Có lỗi xảy ra khi lấy chi tiết cấu hình website");
					return res.sendOk({ data: data, message: "Lấy thông tin website thành công" });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},

		put: {
			middleware: [verify, verifyAdmin, validateUpdateWebsiteConfigEntry],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 *  /website-config:
				 *   put:
				 *     tags: [WebsiteConfig]
				 *     description: Update Website Config
				 *     security:
				 *       - Bearer: []
				 *     requestBody:
				 *       description: Update Website Config Fields
				 *       required: true
				 *       content:
				 *         application/json:
				 *           schema:
				 *            $ref: "#/components/schemas/WebsiteConfigMutate"
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *            schema:
				 *                $ref: '#/components/schemas/Response'
				 */

				try {
					const currentTime = new Date();
					const userId = await userProvider.validateAndFetchUserId(req.user.id as string);
					const websiteConfig = await provider.getOne({
						where: { is_default: true },
						attributes: ["name", "phone", "email", "website", "address", "logo", "banner", "theme"],
					});

					if (!websiteConfig)
						return res.status(404).send({
							status: 404,
							message: "Không tìm thấy thông tin website",
							message_en: "Website config is not found.",
							err: new MeUError(404, "API", "Không tìm thấy thông tin website"),
						});

					const updatedWebsiteConfig = {
						name: req.body.name,
						phone: req.body.phone,
						email: req.body.email,
						website: req.body.website,
						address: req.body.address,
						logo: req.body.logo,
						banner: req.body.banner,
						theme: req.body.theme,
					};
					const logo = updatedWebsiteConfig.logo,
						banner = updatedWebsiteConfig.banner;

					if (logo) {
						if (!mongoose.Types.ObjectId.isValid(logo)) {
							throw new Error("File ID của logo không hợp lệ");
						}

						const existingFile = await fileProvider.getById(logo);
						if (!existingFile) {
							throw new Error("File ID của logo không tồn tại trong hệ thống");
						}
					}

					if (banner) {
						if (!mongoose.Types.ObjectId.isValid(banner)) {
							throw new Error("File ID của banner không hợp lệ");
						}

						const existingFile = await fileProvider.getById(banner);
						if (!existingFile) {
							throw new Error("File ID của banner không tồn tại trong hệ thống");
						}
					}

					const data = await websiteConfig.updateOne({
						...updatedWebsiteConfig,
						updated_by: userId,
						updated_at: currentTime,
					});

					if (data.modifiedCount <= 0) throw new Error("Có lỗi xảy ra khi cập nhật thông tin website");
					return res.sendOk({ data: { message: "Cập nhật thông tin website thành công" } });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
