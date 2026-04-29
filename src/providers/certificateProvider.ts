import { BaseProvider } from "#templates/base/baseProvider";
import { ICertificate, ICertificateMethods, collectionName, schema, ObjectId } from "#models/certificate";
import { ICertificateTemplate } from "#models/certificateTemplate";

export class CertificateProvider extends BaseProvider<ICertificate, ICertificateMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	/**
	 * Generate unique certificate code
	 */
	generateCertificateCode(): string {
		const prefix = "CERT";
		const timestamp = Date.now().toString(36).toUpperCase();
		const random = Math.random().toString(36).substring(2, 5).toUpperCase();
		return `${prefix}-${timestamp}-${random}`;
	}

	/**
	 * Check if participant meets certificate conditions
	 */
	checkConditions(
		template: ICertificateTemplate,
		score: number,
		totalQuestions: number,
		correctAnswers: number,
	): boolean {
		if (!template.is_enabled) return false;

		const { conditions } = template;

		// Check completion required
		if (conditions.completion_required && score === 0) {
			return false;
		}

		// Check min score
		if (score < conditions.min_score) {
			return false;
		}

		// Check require all correct
		if (conditions.require_all_correct && correctAnswers !== totalQuestions) {
			return false;
		}

		return true;
	}

	/**
	 * Create certificate for a participant
	 */
	async createCertificate(
		data: Omit<ICertificate, "_id" | "certificate_code" | "created_at" | "created_by">,
	): Promise<ICertificate> {
		const certificateCode = this.generateCertificateCode();

		const certificateData: ICertificate = {
			...data,
			certificate_code: certificateCode,
			_id: undefined,
			created_at: undefined,
			created_by: undefined,
		};
		const certificate = await this.post(certificateData);
		return certificate;
	}

	/**
	 * Get certificate by code (for verification)
	 */
	async getByCode(code: string): Promise<ICertificate | null> {
		return await this.getOne({
			where: { certificate_code: code },
		});
	}

	/**
	 * Get certificates by user ID
	 */
	async getByUserId(userId: string): Promise<ICertificate[]> {
		const result = await this.getAll({
			where: { user_id: userId },
			sortField: "created_at",
			sortOrder: "desc",
		});
		return result.rows;
	}

	/**
	 * Get certificate by participant ID
	 */
	async getByParticipantId(participantId: string): Promise<ICertificate | null> {
		return await this.getOne({
			where: { participant_id: participantId },
		});
	}

	/**
	 * Revoke a certificate
	 */
	async revokeCertificate(
		certificateId: string,
		reason: string,
		revokedBy: string,
	): Promise<void> {
		await this.put(certificateId, {
			status: "revoked",
			revoked_reason: reason,
			revoked_at: new Date(),
			revoked_by: revokedBy,
		});
	}
}
