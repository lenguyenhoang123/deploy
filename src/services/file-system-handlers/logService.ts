import constant from "../../constants/index";
import nconf from "nconf";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { root } from "../../root";

class LoggingService {
	logChannelType: string;
	logType: string;
	isLogEnabled: boolean;
	logUrl: string;
	logMode: string;
	timeOut: number;

	constructor() {
		this.logChannelType = constant.LOG_CHANNEL_TYPE;
		this.logType = constant.LOG_TYPE;
		this.isLogEnabled = nconf.get("LoggingService").IsEnabled;
		this.logUrl = nconf.get("LoggingService").Url;
		this.logMode = nconf.get("LoggingService").Mode;
		this.timeOut = nconf.get("LoggingService").Timeout;
	}

	async logAsync(category: string, source: string, message: any, params: null) {
		try {
			if (!this.isLogEnabled) return;
			let errorMessage = null;
			if (message?.hasOwnProperty("message")) errorMessage = { message: message.message };

			if (message?.hasOwnProperty("stack")) errorMessage["stack"] = message.stack;

			if (errorMessage == null) errorMessage = message;

			const // Log data
				logMessage = {
					messagesource: source,
					message: JSON.stringify(errorMessage).replace(/(\\n)|\\|"|\s{2,}/g, ""),
					logdatetime: new Date(),
					parameters: JSON.stringify(params),
				},
				jsonData = {
					service: this.logChannelType,
					type: this.logType,
					category: category,
					message: logMessage,
				};

			if (["console", "both"].includes(this.logMode)) console.log(jsonData);
			if (this.logMode != "console") {
				// Logging into file system
				const // Date formatters
					date = new Date(),
					dayLog = // Example: August 15th 2004 => 15082024
						date.getDate().toString().padStart(2, "0") +
						(date.getMonth() + 1).toString().padStart(2, "0") +
						date.getFullYear(),
					timeLog = // Example: 02:02:02 PM => 140202
						date.getHours().toString().padStart(2, "0") +
						date.getMinutes().toString().padStart(2, "0") +
						date.getSeconds().toString().padStart(2, "0"),
					timeRange = // Example: Logged at 13:45 => 1300_1400
						date.getHours().toString().padStart(2, "0") +
						"00_" +
						(date.getHours() + 1).toString().padStart(2, "0") +
						"00";

				const // Path resolvers
					store = resolve(
						root.replace("/dist", ""),
						"storage/logs",
						category == constant.LOG_DB_CATEGORY ? "database" : "",
					),
					folderPath = resolve(store, dayLog),
					filePath = resolve(folderPath, `${timeRange}.log`);

				const fileContent = `${dayLog}${timeLog}: ${JSON.stringify(logMessage)}\n`;

				if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true });
				writeFileSync(filePath, fileContent, { flag: "a+" });
			}
		} catch (ex) {
			console.log(ex);
		}
	}

	async logErrorAsync(source: string, message: Error, params: null) {
		await this.logAsync(constant.LOG_ERROR_CATEGORY, source, message, params);
	}

	async logInfoAsync(source: string, message: Error, params: null) {
		await this.logAsync(constant.LOG_INFO_CATEGORY, source, message, params);
	}

	async logTransAsync(source: string, message: Error, params: null) {
		await this.logAsync(constant.LOG_TRANS_CATEGORY, source, message, params);
	}

	async logDBAsync(query: any) {
		await this.logAsync(constant.LOG_DB_CATEGORY, "Sequelize", query, null);
	}
}

export default LoggingService;
export { LoggingService };
