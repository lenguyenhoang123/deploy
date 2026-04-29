import { BaseProvider } from "#templates/base/baseProvider";
import { ICertificateTemplate, ICertificateTemplateMethods, collectionName, schema, ObjectId } from "#models/certificateTemplate";

export class CertificateTemplateProvider extends BaseProvider<ICertificateTemplate, ICertificateTemplateMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	/**
	 * Get certificate template by exam ID
	 */
	async getByExamId(examId: string): Promise<ICertificateTemplate | null> {
		return await this.getOne({
			where: { exam_id: examId },
		});
	}

	/**
	 * Update or create certificate template for an exam
	 */
	async updateOrCreate(
		examId: string,
		data: Partial<ICertificateTemplate>,
		userId: string,
	): Promise<ICertificateTemplate> {
		const existing = await this.getByExamId(examId);

		if (existing) {
			// Update existing
			await this.put(existing._id!.toString(), {
				...data,
				updated_by: new ObjectId(userId),
			});
			return { ...existing, ...data };
		} else {
			// Create new - ensure required fields are present
			const createData: ICertificateTemplate = {
				name: data.name!,
				is_enabled: data.is_enabled ?? false,
				conditions: data.conditions!,
				design: data.design!,
				exam_id: new ObjectId(examId),
				created_by: new ObjectId(userId),
				legal_text: data.legal_text,
				_id: undefined,
				created_at: undefined,
			};
			const created = await this.post(createData);
			return created;
		}
	}

	/**
	 * Delete certificate template by exam ID
	 */
	async deleteByExamId(examId: string): Promise<void> {
		const template = await this.getByExamId(examId);
		if (template && template._id) {
			await this.delete(template._id.toString());
		}
	}

	/**
	 * Check if exam has enabled certificate template
	 */
	async isCertificateEnabled(examId: string): Promise<boolean> {
		const template = await this.getByExamId(examId);
		return template?.is_enabled ?? false;
	}
}
