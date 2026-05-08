import BaseProvider from "#templates/base/baseProvider";
import { ILearningContent, ILearningContentMethods, collectionName, schema } from "#models/learningContent";

export class LearningContentProvider extends BaseProvider<ILearningContent, ILearningContentMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	async getActiveContent(options?: { populateFile?: boolean }) {
		const includes = options?.populateFile
			? [{ path: "file_id", select: "file_name original_name mime_type file_path size" }]
			: [];

		return await this.getAll({
			where: { is_active: true },
			includes,
			sortField: "sort_order",
			sortOrder: "asc",
		});
	}

	async getByType(type: string, options?: { populateFile?: boolean }) {
		const includes = options?.populateFile
			? [{ path: "file_id", select: "file_name original_name mime_type file_path size" }]
			: [];

		return await this.getAll({
			where: { type, is_active: true },
			includes,
			sortField: "sort_order",
			sortOrder: "asc",
		});
	}

	async getByIdWithFile(id: string) {
		return await this.getOne({
			where: { _id: id },
			includes: [{ path: "file_id", select: "file_name original_name mime_type file_path size" }],
		});
	}
}
