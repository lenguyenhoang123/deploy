import nodemailer from "nodemailer";
import nconf from "nconf";
import { SentMessageInfo } from "nodemailer/lib/smtp-transport";
import { Options } from "nodemailer/lib/mailer";

class MailService {
	transporter?: nodemailer.Transporter<SentMessageInfo>;
	constructor() {
		this.transporter ??= nodemailer.createTransport(nconf.get("smtpOptions"));
	}

	// async replaceMailTemplate(sHtml: string, oReplace: string | any[]) {
	//   let sReturn = sHtml;
	//   for (let i = 0; i < oReplace.length; i++) {
	//     sReturn = sReturn.replace(oReplace[i].replace, oReplace[i].textReplace);
	//   }
	//   return sReturn;
	// }

	async sendmail(mailOptions: Options, callback?: (err: Error, info: SentMessageInfo) => void) {
		return this.transporter.sendMail(mailOptions, callback);
	}
}
export { MailService };
export default MailService;
