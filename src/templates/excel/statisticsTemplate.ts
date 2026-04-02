export const participantStatisticsTemplate = {
	headers: [
		{ header: "STT", key: "index", width: 8 },
		{ header: "Họ và tên", key: "full_name", width: 25 },
		{ header: "Số CCCD", key: "identity_number", width: 18 },
		{ header: "Ngày sinh", key: "date_of_birth", width: 15 },
		{ header: "Giới tính", key: "gender", width: 12 },
		{ header: "Lớp", key: "class_name", width: 10 },
		{ header: "Trường học", key: "school_name", width: 30 },
		{ header: "Địa chỉ trường", key: "school_address", width: 35 },
		{ header: "SĐT", key: "phone", width: 15 },
		{ header: "Số lượt thi", key: "total_attempts", width: 15 },
		{ header: "Điểm cao nhất", key: "best_score", width: 15 },
		{ header: "Thời gian (phút:giây)", key: "formatted_time", width: 22 },
		{ header: "Ngày thi (điểm cao nhất)", key: "best_submit_date", width: 25 },
	],
};

export const unitStatisticsTemplate = {
	headers: [
		{ header: "STT", key: "index", width: 8 },
		{ header: "Trường học", key: "unit_name", width: 35 },
		{ header: "Loại trường", key: "school_type", width: 15 },
		{ header: "Địa chỉ", key: "unit_address", width: 40 },
		{ header: "Số lượt tham gia", key: "participant_count", width: 18 },
		{ header: "Tổng điểm đúng", key: "correct_count", width: 18 },
		{ header: "Điểm TB", key: "avg_correct_count", width: 12 },
		{ header: "Tổng thời gian (phút)", key: "formatted_time_taken", width: 22 },
		{ header: "Thời gian TB (phút)", key: "avg_time_taken", width: 20 },
		{ header: "Xếp hạng", key: "rank", width: 12 },
	],
};
