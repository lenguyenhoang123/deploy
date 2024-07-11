import { Model, FilterQuery, Schema, UpdateQuery } from "mongoose";
import { connectMongo } from "../services/database/mongoose";
import LoggingService from "../services/file-system-handlers/logService";

class BaseProvider<ModelType> {
	private collection: Model<ModelType>;
	private logger = new LoggingService();

	constructor(collectionInit?: { collectionName: string; schema: Schema<ModelType> }, collection?: Model<ModelType>) {
		if (collection) {
			this.collection = collection;
			return;
		}
		if (!collectionInit) throw new Error("Provider must either include init attr or a collection");
		const { collectionName, schema } = collectionInit;
		connectMongo().then((db) => (this.collection = db.model<ModelType>(collectionName, schema)));
		return;
	}

	async getAll(payload?: {
		where?: FilterQuery<ModelType>;
		currentPage?: number;
		pageSize?: number;
		attributes?: string[];
		sortField?: string;
		sortOrder?: string;
	}) {
		const where = payload?.where ?? {};
		const limit = payload && payload.pageSize;
		const skip = (payload.currentPage - 1) * (limit ?? 0) || 0;
		const attributes = payload?.attributes;
		const sort = payload?.sortField && {
			[payload.sortField]: ((sortOrder: string) => {
				switch (sortOrder.toLowerCase()) {
					default:
						return -1;
					case "asc":
						return "asc";
				}
			})(payload.sortOrder),
		};
		const count = await this.collection.countDocuments(where);
		return {
			count: await this.collection.countDocuments(where),
			count_unread: await this.collection.countDocuments({ $and: [where, { has_user_read: false }] }),
			rows: await this.collection.find(where, attributes, {
				skip,
				limit,
				sort,
			}),
			totalPages: Math.ceil(count / (payload.pageSize ?? count)),
			currentPage: payload.currentPage ?? 1,
		};
	}

	async getById(id: string) {
		return await this.collection.findById(id);
	}

	async bulkCreate(body: ModelType[]) {
		this.logger.logDBAsync(`Bulk creating ${JSON.stringify(body)}`);
		return await this.collection.insertMany(body);
	}

	async bulkUpdate(
		where: FilterQuery<ModelType>,
		body: UpdateQuery<Omit<ModelType, "_id" | "created_at" | "created_by" | "updated_at">>,
		notDeleteFields: string[] = [],
	) {
		this.logger.logDBAsync(`Bulk updating ${JSON.stringify(body)}, where ${JSON.stringify(where)}`);
		const deleteFields: Set<string> = new Set([]);
		for (const key in body) {
			if (body[key] === null && !notDeleteFields.includes(key)) {
				deleteFields.add(key);
				delete body[key];
			}
		}
		return await this.collection.updateMany(where, {
			$set: body,
			$unset: Array.from(deleteFields).reduce((acc, field) => ({ ...acc, [field]: "" }), {}),
		});
	}

	async put(id: string, body: UpdateQuery<ModelType>) {
		this.logger.logDBAsync(`Updating ${JSON.stringify(body)}, where ${id}`);
		return await this.collection.updateOne({ id }, body);
	}

	async delete(id: string) {
		this.logger.logDBAsync(`Deleting ${id}, where ${id}`);
		return await this.collection.deleteOne({ id });
	}

	async bulkDelete(where: FilterQuery<ModelType>) {
		this.logger.logDBAsync(`Bulk deleting ${JSON.stringify(where)}, where ${JSON.stringify(where)}`);
		return await this.collection.deleteMany(where);
	}
}

export default BaseProvider;
