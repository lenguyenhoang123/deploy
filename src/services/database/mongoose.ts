import mongoose from "mongoose";
import nconf from "nconf";
import { serverLog } from "../../server";
import LoggingService from "../../services/file-system-handlers/logService";

const connectMongo = async () => {
	const logger = new LoggingService();
	try {
		if (mongoose.connection.readyState === 1) {
			logger.logDBAsync("Already connected");
			return mongoose;
		}
		const db = nconf.get("Database") as {
			DB_AUTHDB: string;
			DB_DATABASE: string;
			DB_USER: string;
			DB_PASS: string;
			DB_HOST: string;
			DB_PORT: string;
		};
		// Build connection string with auth only if credentials are provided
		let connectionString: string;
		if (db.DB_USER && db.DB_PASS) {
			connectionString = `mongodb://${db.DB_USER}:${db.DB_PASS}@${db.DB_HOST}:${db.DB_PORT}/${db.DB_AUTHDB}`;
		} else {
			connectionString = `mongodb://${db.DB_HOST}:${db.DB_PORT}`;
		}
		serverLog(`Connecting to MongoDB at ${connectionString}`);
		await mongoose.connect(connectionString, { dbName: db.DB_DATABASE });
		logger.logDBAsync("Successfully connected");
		serverLog("Successfully connected");
		return mongoose;
	} catch (err) {
		serverLog(err);
		logger.logDBAsync("Failed");
	}
};

const disconnectMongo = async () => {
	await mongoose.disconnect();
};

export { connectMongo, disconnectMongo };
