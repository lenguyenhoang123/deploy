export const participantStatisticsTemplate = {
	headers: [
		{ header: "STT", key: "index", width: 10 },
		{ header: "Họ và tên", key: "full_name", width: 25 },
		{ header: "Đơn vị", key: "unit", width: 20 },
		{ header: "Số câu trả lời đúng", key: "correct_count", width: 20 },
		{ header: "Thời gian hoàn thành", key: "formatted_time_taken", width: 25 },
		{ header: "Vị trí xếp hạng", key: "rank", width: 15 },
	],
};

export const unitStatisticsTemplate = {
	headers: [
		{ header: "STT", key: "index", width: 10 },
		{ header: "Tên đơn vị", key: "district", width: 25 },
		{ header: "Số lượng cán bộ tham gia", key: "participant_count", width: 25 },
		{ header: "Tổng số câu trả lời đúng", key: "correct_count", width: 25 },
		{ header: "Tổng thời gian hoàn thành", key: "formatted_time_taken", width: 25 },
		{ header: "Vị trí xếp hạng", key: "rank", width: 15 },
	],
};
