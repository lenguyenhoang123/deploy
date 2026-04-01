import { IPaginationResult, ISortCriteria, ISortOptions } from "#services/interfaces/istatistics";

// Sort And Rank Data
export function parseSortOptions(sortByParam: string | undefined): ISortCriteria[] {
	if (!sortByParam) {
		return [
			{ field: "correct_count", order: "desc" },
			{ field: "time_taken", order: "asc" },
		];
	}

	return sortByParam.split(";").map((sortOption) => {
		const [field, order] = sortOption.split(",");
		return {
			field,
			order: order as "asc" | "desc",
		};
	});
}

export function sortAndRankData(array: any[], options: ISortOptions): any[] {
	const sortedData = multiLayerSort(array, options);
	return assignRanks(sortedData, options.sortBy);
}

function multiLayerSort(array: any[], options: ISortOptions): any[] {
	const { sortBy } = options;

	return array.sort((a, b) => {
		for (const { field, order } of sortBy) {
			const valueA = a[field as keyof typeof a];
			const valueB = b[field as keyof typeof b];

			if (valueA !== valueB) {
				return order === "desc" ? compareValues(valueB, valueA) : compareValues(valueA, valueB);
			}
		}
		return 0;
	});
}

export function compareValues(valueA: any, valueB: any): number {
	if (typeof valueA === "number" && typeof valueB === "number") {
		return valueA - valueB;
	} else if (typeof valueA === "string" && typeof valueB === "string") {
		return valueA.localeCompare(valueB);
	}
	return 0;
}

function assignRanks(array: any[], sortBy: ISortCriteria[]): any[] {
	let currentRank = 1;
	let lastRank = 1;
	let lastItem: any = null;

	return array.map((item, index) => {
		if (index > 0 && isEqualByCriteria(lastItem, item, sortBy)) {
			item.rank = lastRank;
		} else {
			item.rank = currentRank;
			lastRank = currentRank;
		}

		lastItem = item;
		currentRank++;
		return item;
	});
}

function isEqualByCriteria(itemA: any, itemB: any, sortBy: ISortCriteria[]): boolean {
	return sortBy.every(({ field, order }) => {
		const valueA = itemA[field as keyof typeof itemA];
		const valueB = itemB[field as keyof typeof itemB];

		if (typeof valueA === "number" && typeof valueB === "number") {
			return order === "desc" ? valueB === valueA : valueA === valueB;
		} else if (typeof valueA === "string" && typeof valueB === "string") {
			return valueA === valueB;
		}
		return false;
	});
}

// Query
export function applyFilters<T>(data: T[], where: Record<string, any>): T[] {
	if (!where) return data;
	return data.filter((item) => Object.keys(where).every((key) => item[key] === where[key]));
}

export function applySorting<T>(data: T[], sortBy: string): T[] {
	const sortOptions = parseSortOptions(sortBy);
	return sortAndRankData(data, { sortBy: sortOptions });
}

export function applyPagination<T>(data: T[], pageSize: number, currentPage: number): T[] {
	if (!pageSize || !currentPage) return data;
	const startIndex = (currentPage - 1) * pageSize;
	const endIndex = startIndex + pageSize;
	return data.slice(startIndex, endIndex);
}

// Pagination
export function generatePaginationResult(data: any[], pageSize?: number, currentPage: number = 1): IPaginationResult {
	const count = data.length;
	const totalPages = Math.ceil(count / (pageSize ?? count));
	const rows = pageSize ? data.slice((currentPage - 1) * pageSize, currentPage * pageSize) : data;

	return {
		count,
		rows,
		totalPages,
		currentPage,
	};
}

// Export
export function formattedDataToExport(array: any[]): any[] {
	return array.map((item, index) => ({
		...item,
		index: index + 1,
		full_name: item.first_name ? getFullName(item) : undefined,
		unit: item.ward ? getUnitName(item) : undefined,
		formatted_time_taken: item.time_taken ? convertMinutesToHMS(item.time_taken) : undefined,
	}));
}

// New formatter for participant export with profile fields
export function formattedParticipantDataToExport(array: any[]): any[] {
	return array.map((item, index) => ({
		index: index + 1,
		full_name: getFullName(item),
		identity_number: item.identity_number || "",
		date_of_birth: item.date_of_birth || "",
		gender: item.gender || "",
		class_name: item.class_name || "",
		school_name: item.school_name || "",
		school_address: item.school_address || "",
		phone: item.phone || "",
		total_attempts: item.total_attempts || 0,
		best_score: item.best_score || 0,
		formatted_time: item.best_time_taken ? convertMinutesToHM(item.best_time_taken) : "",
		best_submit_date: item.best_submit_time ? formatDate(item.best_submit_time) : "",
	}));
}

// Helper to classify student as THCS or THPT based on class_name
export function classifyStudentLevel(className: string): "THCS" | "THPT" | "OTHER" {
	if (!className) return "OTHER";
	
	// Normalize class name
	const normalized = className.toString().toLowerCase().trim();
	
	// THCS: Lớp 6, 7, 8, 9
	if (/^[6-9]$/.test(normalized) || normalized.includes("lớp 6") || normalized.includes("lớp 7") || normalized.includes("lớp 8") || normalized.includes("lớp 9")) {
		return "THCS";
	}
	
	// THPT: Lớp 10, 11, 12
	if (/^1[0-2]$/.test(normalized) || normalized.includes("lớp 10") || normalized.includes("lớp 11") || normalized.includes("lớp 12")) {
		return "THPT";
	}
	
	return "OTHER";
}

function getFullName(stat: any) {
	return [stat.last_name, stat.middle_name, stat.first_name].filter((val) => val).join(" ");
}

function getUnitName(stat: any) {
	return `${stat.ward} - ${stat.district}`;
}

function convertMinutesToHMS(minutes: number): string {
	const totalSeconds = Math.round(minutes * 60);
	const hours = Math.floor(totalSeconds / 3600);
	const minutesLeft = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return `${hours}h ${minutesLeft}m ${seconds}s`;
}

function convertMinutesToHM(minutes: number): string {
	const totalSeconds = Math.round(minutes * 60);
	const mins = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	return `${mins}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string | Date): string {
	if (!dateString) return "";
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return "";
	
	const day = date.getDate().toString().padStart(2, "0");
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const year = date.getFullYear();
	
	return `${day}/${month}/${year}`;
}
