import nodemailer from "nodemailer";
import nconf from "nconf";
import { SentMessageInfo } from "nodemailer/lib/smtp-transport";
import { Options } from "nodemailer/lib/mailer";

class MailService {
	transporter?: nodemailer.Transporter<SentMessageInfo>;
	constructor() {
		const smtpOptions = nconf.get("smtpOptions") || {};
		this.transporter ??= nodemailer.createTransport({
			...smtpOptions,
			// Accept self-signed certificates in development
			tls: {
				rejectUnauthorized: false,
			},
		});
	}

	// async replaceMailTemplate(sHtml: string, oReplace: string | any[]) {
	//   let sReturn = sHtml;
	//   for (let i = 0; i < oReplace.length; i++) {
	//     sReturn = sReturn.replace(oReplace[i].replace, oReplace[i].textReplace);
	//   }
	//   return sReturn;
	// }

	async sendmail(mailOptions: Options, callback?: (err: Error, info: SentMessageInfo) => void) {
		console.log("[MAIL] Sending email to:", mailOptions.to);
		console.log("[MAIL] Subject:", mailOptions.subject);
		console.log("[MAIL] From:", mailOptions.from);
		
		try {
			const result = await this.transporter.sendMail(mailOptions, callback);
			console.log("[MAIL] Email sent successfully:", (result as any).messageId);
			console.log("[MAIL] Response:", result);
			return result;
		} catch (error) {
			console.error("[MAIL] Email send failed:", error);
			throw error;
		}
	}
}
export { MailService };
export default MailService;
