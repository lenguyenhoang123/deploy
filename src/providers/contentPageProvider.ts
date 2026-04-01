import BaseProvider from "#templates/base/baseProvider";
import { IContentPage, IContentPageMethods, collectionName, schema } from "#models/contentPage";

export class ContentPageProvider extends BaseProvider<IContentPage, IContentPageMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	async getBySlug(slug: string, options?: { populateFiles?: boolean }) {
		const includes = options?.populateFiles
			? [{ path: "files", select: "file_name original_name mime_type file_path size" }]
			: [];

		return await this.getOne({
			where: { slug },
			includes,
		});
	}
}
