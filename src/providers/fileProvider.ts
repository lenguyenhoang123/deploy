import BaseProvider from "#templates/base/baseProvider";
import { IFile, IFileMethods, collectionName, schema } from "#models/file";

export class FileProvider extends BaseProvider<IFile, IFileMethods> {
	constructor() {
		super({ collectionName, schema });
	}
}
