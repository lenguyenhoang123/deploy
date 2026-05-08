import { Model, Schema, Types } from "mongoose";

// Export ObjectId constructor and type for consistency
export const ObjectId = Types.ObjectId;
export type ObjectId = Types.ObjectId;

export interface ICertificateUserInfo {
	full_name: string;
	identity_number?: string;
	class_name?: string;
	school_name?: string;
}

export interface ICertificateExamInfo {
	name: string;
	completion_date: Date;
	score: number;
	rank?: number;
}

export interface ICertificate {
	_id?: ObjectId;
	certificate_code: string;
	type: "exam" | "learning_quiz"; // Certificate type
	
	// For Exam type
	exam_id?: ObjectId;
	participant_id?: ObjectId;
	
	// For Learning Quiz type
	quiz_attempt_id?: ObjectId;
	content_id?: ObjectId;
	quiz_id?: ObjectId;
	
	user_id: ObjectId;
	template_id?: ObjectId;

	user_info: ICertificateUserInfo;
	exam_info: ICertificateExamInfo;

	file_id?: ObjectId;
	file_url?: string;

	status: "active" | "revoked" | "expired";
	revoked_reason?: string;
	revoked_at?: Date;
	revoked_by?: ObjectId;
	certificateNotified?: boolean;

	created_at?: Date;
	created_by?: ObjectId;
}

export interface ICertificateMethods {}
export type CertificateModel = Model<ICertificate, {}, ICertificateMethods>;

const userInfoSchema = new Schema<ICertificateUserInfo>(
	{
		full_name: { type: String, required: true },
		identity_number: { type: String },
		class_name: { type: String },
		school_name: { type: String },
	},
	{ _id: false },
);

const examInfoSchema = new Schema<ICertificateExamInfo>(
	{
		name: { type: String, required: true },
		completion_date: { type: Date, required: true },
		score: { type: Number, required: true },
		rank: { type: Number },
	},
	{ _id: false },
);

export const collectionName = "certificate";
export const schema = (function () {
	const newSchema = new Schema<ICertificate, CertificateModel, ICertificateMethods>(
		{
			certificate_code: { type: String, required: true, unique: true, index: true },
			type: { type: String, enum: ["exam", "learning_quiz"], required: true, default: "exam" },
			
			// For Exam type
			exam_id: { type: Schema.Types.ObjectId, index: true },
			participant_id: { type: Schema.Types.ObjectId, index: true, sparse: true },
			
			// For Learning Quiz type
			quiz_attempt_id: { type: Schema.Types.ObjectId, index: true },
			content_id: { type: Schema.Types.ObjectId, index: true },
			quiz_id: { type: Schema.Types.ObjectId, index: true },
			
			user_id: { type: Schema.Types.ObjectId, required: true, index: true },
			template_id: { type: Schema.Types.ObjectId },

			user_info: { type: userInfoSchema, required: true },
			exam_info: { type: examInfoSchema, required: true },

			file_id: { type: Schema.Types.ObjectId },
			file_url: { type: String },

			status: { type: String, enum: ["active", "revoked", "expired"], default: "active" },
			revoked_reason: { type: String },
			revoked_at: { type: Date },
			revoked_by: { type: Schema.Types.ObjectId },
			certificateNotified: { type: Boolean, default: false },

			created_by: { type: Schema.Types.ObjectId },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: null },
		},
	);
	
	// Compound index to prevent duplicate certificates for same quiz attempt
	newSchema.index({ quiz_attempt_id: 1, user_id: 1 }, { unique: true, sparse: true });
	// Compound index for exam participant - chỉ áp dụng khi có participant_id và exam_id
	newSchema.index({ participant_id: 1, exam_id: 1 }, { unique: true, sparse: true, partialFilterExpression: { participant_id: { $exists: true }, exam_id: { $exists: true } } });
	
	return newSchema;
})();
