import LoggingService from "../services/file-system-handlers/logService";
import dayjs from "dayjs";
import { v4, validate } from "uuid";
import { Document, Schema } from "mongoose";

export type NotificationDocument = Document<unknown, {}, NotificationModel> & NotificationModel;

export type NotificationModel = {
	_id: string;
	title?: string;
	content?: string;
	category?: string;
	sub_category?: string;
	belongs_to_user_id?: string;
	sent_time?: Date;
	has_noti_sent: boolean;
	has_user_read?: boolean;
	created_by?: string;
	expired_at?: Date;
	[key: string]: any;
};

export type NotificationCreationAttributes = NotificationModel;

export type NotificationUpdateAttributes = Partial<
	Omit<NotificationModel, "_id" | "created_at" | "created_by" | "updated_at">
>;

type QueryResponse = NotificationDocument;

export const syncNotiToKafka = async (notification: QueryResponse) => {
	if (notification.has_user_read) return;

	const isNotiSent = dayjs(notification.sent_time).isAfter(dayjs()) || notification.has_noti_sent;
	if (isNotiSent) return;

	const logger = new LoggingService();
	try {
		notification.has_noti_sent = true;
		await notification.save();
	} catch (error) {
		logger.logErrorAsync("Kafka", error, null);
	}

	return;
};

export const NotificationSchema = new Schema<NotificationModel>(
	{
		_id: {
			type: String,
			required: true,
			validate: {
				validator: (value: string) => validate(value),
			},
		},
		title: { type: String, required: false },
		content: { type: String, required: false },
		category: { type: String, required: false },
		sub_category: { type: String, required: false },
		belongs_to_user_id: {
			type: String,
			required: false,
			validate: {
				validator: (value: string) => value == null || validate(value),
			},
		},
		has_user_read: { type: Boolean, required: false },
		sent_time: { type: Date, required: true },
		has_noti_sent: { type: Boolean, default: false },
		expired_at: {
			type: Date,
			required: false,
		},
		add_info: {
			type: String,
			required: false,
			validate: {
				validator: (value: string) => {
					try {
						return JSON.parse(value) && !!value;
					} catch (e) {
						return false;
					}
				},
			},
		},
	},
	{
		strict: false,
		timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	},
);

NotificationSchema.pre("validate", function (next) {
	if (this.isNew) {
		this._id = v4();
		this.has_user_read = false;
		this.has_noti_sent = false;
	}
	if (!this.sent_time) {
		this.sent_time = new Date();
	}
	next();
});

NotificationSchema.post("insertMany", async function (rows: Array<QueryResponse>) {
	return await Promise.all(rows.map((row) => syncNotiToKafka(row)));
});

NotificationSchema.post("save", async function (res: QueryResponse) {
	return await syncNotiToKafka(res);
});

NotificationSchema.pre("updateMany", function (next) {
	this.setOptions({ runValidators: true });
	next();
});
