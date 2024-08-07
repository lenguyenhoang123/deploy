export interface IUnitStatistics {
	district?: string;
	ward?: string;
	participant_count: number;
	correct_count: number;
	time_taken: number;
	rank?: number;
}

export interface IParticipantStatistics {
	first_name: string;
	middle_name: string;
	last_name: string;
	district: string;
	ward: string;
	correct_count: number;
	time_taken: number;
	rank?: number;
}

export interface IResult {
	exam_name: string;
	allowed_time: number;
	template_name: string;
	quantity: number;
	correct_count: number;
	time_taken: number;
	questions?: any[];
}

export interface ISortCriteria {
	field: string;
	order: "asc" | "desc";
}

export interface ISortOptions {
	sortBy: ISortCriteria[];
}

export interface IQueryOptions {
	where?: Record<string, any>;
	pageSize?: number;
	currentPage?: number;
	sortBy?: string;
}
