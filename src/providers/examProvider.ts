import BaseProvider from "#templates/base/baseProvider";
import { IExam, IExamMethods, collectionName, schema } from "#models/exam";

export class ExamProvider extends BaseProvider<IExam, IExamMethods> {
	constructor() {
		super({ collectionName, schema });
	}
}
