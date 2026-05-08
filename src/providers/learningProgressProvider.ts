import BaseProvider from "#templates/base/baseProvider";
import mongoose from "mongoose";
import { ILearningProgress, ILearningProgressMethods, collectionName, schema } from "#models/learningProgress";

export class LearningProgressProvider extends BaseProvider<ILearningProgress, ILearningProgressMethods> {
	constructor() {
		super({ collectionName, schema });
	}

	async getUserProgress(userId: string, contentId?: string) {
		const where: any = { user_id: userId };
		if (contentId) {
			where.content_id = contentId;
		}

		const includes = [
			{ path: "content_id", select: "title type estimated_reading_time difficulty_level" }
		];

		return await this.getAll({
			where,
			includes,
		});
	}

	async getOrCreateProgress(userId: string, contentId: string) {
		// First try to find existing progress
		const existing = await this.getOne({
			where: { user_id: userId, content_id: contentId },
			includes: [
				{ path: "content_id", select: "title type estimated_reading_time difficulty_level" }
			]
		});

		if (existing) {
			return existing;
		}

		// If not found, try to create new progress with error handling
		try {
			return await this.post({
				user_id: userId as any,
				content_id: contentId as any,
				status: "not_started",
				progress_percentage: 0,
				time_spent: 0,
				scroll_position: 0,
			});
		} catch (error: any) {
			// Handle duplicate key error - try to fetch the record again
			if (error.code === 11000) {
				const retryExisting = await this.getOne({
					where: { user_id: userId, content_id: contentId },
					includes: [
						{ path: "content_id", select: "title type estimated_reading_time difficulty_level" }
					]
				});
				if (retryExisting) {
					return retryExisting;
				}
			}
			// Re-throw if it's not a duplicate key error or if we can't find the existing record
			throw error;
		}
	}

	async updateProgress(userId: string, contentId: string, updates: Partial<ILearningProgress>) {
		const progressData = {
			...updates,
			updated_at: new Date(),
		};

		// Auto-mark as completed if progress reaches 100%
		if (updates.progress_percentage === 100) {
			progressData.status = "completed";
			progressData.completed_at = new Date();
		} else if (updates.progress_percentage && updates.progress_percentage > 0) {
			progressData.status = "in_progress";
		}

		return await this.bulkUpdate(
			{ user_id: userId, content_id: contentId },
			progressData
		);
	}

	async getCompletedContent(userId: string) {
		return await this.getAll({
			where: { user_id: userId, status: "completed" },
			includes: [
				{ path: "content_id", select: "title type estimated_reading_time difficulty_level" }
			],
		});
	}
}
