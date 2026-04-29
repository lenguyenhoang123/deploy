import { Model, Schema, Types } from "mongoose";

export interface IFile {
	file_name: string;
	original_name: string;
	mime_type: string;
	file_type: string;
	file_path: string;
	size: number;
	created_at?: Date;
	created_by?: Types.ObjectId;
	updated_at?: Date;
	updated_by?: Types.ObjectId;
}
export interface IFileMethods {}
export type FileModel = Model<IFile, {}, IFileMethods>;

export const collectionName = "file";
export const schema = (function () {
	const newSchema = new Schema<IFile, FileModel, IFileMethods>(
		{
			file_name: { type: String, required: true, unique: true },
			original_name: { type: String, required: true },
			mime_type: { type: String, required: true },
			file_type: { type: String, required: true },
			file_path: { type: String, required: true },
			size: { type: Number, required: true },
			created_by: { type: Schema.Types.ObjectId, Ref: collectionName },
			updated_by: { type: Schema.Types.ObjectId, Ref: collectionName },
		},
		{
			timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
		},
	);
	return newSchema;
})();
