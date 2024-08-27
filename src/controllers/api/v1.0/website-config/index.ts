import verify, { verifyAdmin } from "#middlewares/auth";
import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import { validateUpdateWebsiteConfigEntry } from "#middlewares/validator";
import { WebsiteConfigProvider } from "#providers/websiteConfigProvider";
import { UserProvider } from "#providers/userProvider";
import { MeUError } from "#dto/MeUErrorDTO";

export default (_express: Application) => {
	const provider = new WebsiteConfigProvider();
	const userProvider = new UserProvider();
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
					let existingInfo = await provider.getOne({
						where: { is_default: true },
						attributes: ["name", "phone", "email", "website", "address", "logo", "banner", "theme", "is_default"],
					});

					if (!existingInfo) {
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
						existingInfo = await provider.post({ ...newInfo });
					}

					const websiteConfig = {
						name: existingInfo.name,
						phone: existingInfo.phone,
						email: existingInfo.email,
						website: existingInfo.website,
						address: existingInfo.address,
						banner: existingInfo.banner,
						theme: existingInfo.theme,
						logo: existingInfo.logo,
					};

					return res.sendOk({ data: websiteConfig, message: "Lấy thông tin website thành công" });
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

					const data = await websiteConfig.updateOne({
						name: req.body.name,
						phone: req.body.phone,
						email: req.body.email,
						website: req.body.website,
						address: req.body.address,
						banner: req.body.banner,
						theme: req.body.theme,
						logo: req.body.logo,
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
