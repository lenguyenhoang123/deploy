export interface IUnitStatistics {
	unit_name?: string;
	unit_address?: string;
	district?: string;
	ward?: string;
	participant_count: number;
	total_correct_count?: number;
	avg_correct_count?: number;
	total_time_taken?: number;
	avg_time_taken?: number;
	correct_count?: number;
	time_taken?: number;
	rank?: number;
}

export interface IParticipantStatistics {
	_id: string;
	first_name: string;
	middle_name?: string;
	last_name: string;
	identity_number?: string;
	date_of_birth?: string;
	gender?: string;
	class_name?: string;
	school_name?: string;
	school_address?: string;
	phone?: string;
	classification?: string;
	district?: string;
	ward?: string;
	total_attempts: number;
	best_score: number;
	best_time_taken: number;
	best_submit_time?: Date;
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

export interface IPaginationResult {
	count: number;
	rows: any[];
	totalPages: number;
	currentPage: number;
}
