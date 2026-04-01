import { Model, FilterQuery, Schema, UpdateQuery, PopulateOptions } from "mongoose";
import { connectMongo } from "../../services/database/mongoose";
import LoggingService from "../../services/file-system-handlers/logService";
import { ObjectId } from "mongodb";

export type BaseQueryOption<ModelInterface> = {
	where?: FilterQuery<ModelInterface>;
	attributes?: string[];
	includes?: PopulateOptions[];
};

export type PaginationOption = {
	currentPage?: number;
	pageSize?: number;
	sortField?: string;
	sortOrder?: string;
};

class BaseProvider<ModelInterface, ModelMethods> {
	private collection: Model<ModelInterface, {}, ModelMethods>;
	private logger = new LoggingService();
	private collectionReady: Promise<void | Model<ModelInterface, {}, ModelMethods>>;

	constructor(
		collectionInit?: {
			collectionName: string;
			schema: Schema<ModelInterface, Model<ModelInterface, {}, ModelMethods>>;
		},
		collection?: Model<ModelInterface, {}, ModelMethods>,
	) {
		if (collection) {
			this.collection = collection;
			this.collectionReady = Promise.resolve();
			return;
		}
		if (!collectionInit) throw new Error("Provider must either include init attr or a collection");
		const { collectionName, schema } = collectionInit;
		this.collectionReady = connectMongo()
			.then(
				(db) =>
					(this.collection = db.model<ModelInterface, Model<ModelInterface, {}, ModelMethods>>(
						collectionName,
						schema,
						collectionName,
					)),
			)
			.catch((err) => {
				this.logger.logDBAsync("Cannot connect to database");
				console.log(err);
			});
		return;
	}

	private async ensureCollection() {
		await this.collectionReady;
		if (!this.collection) {
			throw new Error("Database collection not initialized");
		}
	}

	async getAll(payload?: BaseQueryOption<ModelInterface> & PaginationOption) {
		await this.ensureCollection();
		// Init Query
		const where = payload?.where ?? {};
		const limit = payload && payload.pageSize;
		const attributes = payload?.attributes;
		// Init Pagination
		const skip = (payload.currentPage - 1) * (limit ?? 0) || 0;
		const populates = payload?.attributes ?? [];
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
		// Execute Query
		const count = await this.collection.countDocuments(where);
		const rows = await this.collection
			.find(where, attributes, {
				skip,
				limit,
				sort,
			})
			.populate(populates);
		return {
			count,
			rows,
			totalPages: Math.ceil(count / (payload.pageSize ?? count)),
			currentPage: payload.currentPage ?? 1,
		};
	}

	async getById(id: string, payload?: Omit<BaseQueryOption<ModelInterface>, "where">) {
		await this.ensureCollection();
		const attributes = payload?.attributes;
		const populates = payload?.includes ?? [];
		return await this.collection.findById(id, attributes).populate(populates);
	}

	async getOne(payload: BaseQueryOption<ModelInterface>) {
		await this.ensureCollection();
		const where = payload?.where ?? {};
		const attributes = payload?.attributes;
		const populates = payload?.includes ?? [];

		return await this.collection.findOne(where, attributes).populate(populates);
	}

	async bulkCreate(body: ModelInterface[]) {
		this.logger.logDBAsync(`Bulk creating ${JSON.stringify(body)}`);
		return await this.collection.insertMany(body);
	}

	async post(body: ModelInterface) {
		this.logger.logDBAsync(`Creatting ${JSON.stringify(body)}`);
		return await this.collection.create(body);
	}

	async bulkUpdate(
		where: FilterQuery<ModelInterface>,
		body: UpdateQuery<Omit<ModelInterface, "_id" | "created_at" | "created_by" | "updated_at">>,
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
	async put(id: string, body: UpdateQuery<ModelInterface>) {
		this.logger.logDBAsync(`Updating ${JSON.stringify(body)}, where ${id}`);
		return await this.collection.updateOne({ _id: new ObjectId(id) }, { $set: body });
	}

	async delete(id: string) {
		this.logger.logDBAsync(`Deleting ${id}, where ${id}`);
		return await this.collection.findByIdAndDelete(id);
	}

	async bulkDelete(where: FilterQuery<ModelInterface>) {
		this.logger.logDBAsync(`Bulk deleting ${JSON.stringify(where)}, where ${JSON.stringify(where)}`);
		return await this.collection.deleteMany(where);
	}
}

export { BaseProvider };
export default BaseProvider;
