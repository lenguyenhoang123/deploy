# Hướng Dẫn Sử Dụng Hệ Thống Chấm Điểm

## Tổng Quan

Hệ thống chấm điểm hỗ trợ 2 loại câu hỏi:
- **Trắc nghiệm (MULTIPLE_CHOICE)**: Tự động chấm điểm khi thí sinh nộp bài
- **Tự luận (ESSAY)**: Cần giáo viên/admin chấm điểm thủ công sau khi nộp bài

## Luồng Chấm Điểm

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Thí sinh làm   │────▶│  Thí sinh nộp   │────▶│  Chấm điểm      │
│  bài thi        │     │  bài            │     │  tự động (MC)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Có câu tự luận?│
                                               └─────────────────┘
                                                        │
                              Không                      │                      Có
                               │                         │                       │
                               ▼                         ▼                       ▼
                        ┌─────────────┐          ┌─────────────┐        ┌─────────────┐
                        │ Hoàn tất    │          │ Hoàn tất    │        │ Chờ chấm    │
                        │             │          │ (MC only)   │        │ điểm tự luận │
                        └─────────────┘          └─────────────┘        └─────────────┘
                                                                               │
                                                                               ▼
                                                                        ┌─────────────┐
                                                                        │ Admin chấm  │
                                                                        │ điểm tự luận │
                                                                        └─────────────┘
                                                                               │
                                                                               ▼
                                                                        ┌─────────────┐
                                                                        │ Tổng điểm   │
                                                                        │ cuối cùng   │
                                                                        └─────────────┘
```

## Cơ Chế Tính Điểm

### 1. Câu Trắc Nghiệm (Multiple Choice)

- **Điểm mỗi câu**: 1 điểm (nếu trả lời đúng)
- **Tự động chấm**: Hệ thống tự động so sánh `user_answer` với đáp án đúng
- **Trường `is_correct`**: `true` nếu đúng, `false` nếu sai

**Ví dụ dữ liệu:**
```json
{
  "question_id": "6699f4391c7ab023b0a77b5b",
  "user_answer": "6699f4391c7ab023b0a77b5c",
  "is_correct": true,
  "score": null
}
```

### 2. Câu Tự Luận (Essay)

- **Điểm nhập vào**: Từ 0 đến 1 (ví dụ: 0, 0.5, 0.75, 1)
- **Chấm thủ công**: Admin/Giáo viên nhập điểm qua API
- **Trường `is_correct`**: 
  - `null`: Chưa chấm
  - `true`: Đã chấm và có điểm > 0
  - `false`: Đã chấm và điểm = 0
- **Trường `score`**: Điểm số cụ thể (ví dụ: 0.5, 0.75)

**Ví dụ dữ liệu trước khi chấm:**
```json
{
  "question_id": "6699f4391c7ab023b0a77b5c",
  "text_answer": "Câu trả lời của thí sinh...",
  "is_correct": null,
  "score": null
}
```

**Ví dụ dữ liệu sau khi chấm:**
```json
{
  "question_id": "6699f4391c7ab023b0a77b5c",
  "text_answer": "Câu trả lời của thí sinh...",
  "is_correct": true,
  "score": 0.75
}
```

### 3. Tính Tổng Điểm

```
Tổng điểm = (Số câu MC đúng × 1) + (Tổng điểm các câu tự luận)
```

**Ví dụ:**
- 5 câu MC đúng: 5 × 1 = 5 điểm
- 2 câu tự luận: 0.75 và 0.5 = 1.25 điểm
- **Tổng**: 6.25 điểm

## API Chấm Điểm

### 1. Lấy Danh Sách Câu Tự Luận Cần Chấm

```http
GET /api/v1/exam-participant/{id}/essay-answers
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "data": {
    "participant_id": "6699f4391c7ab023b0a77b5b",
    "exam_name": "Kiểm tra giữa kỳ",
    "user_name": "Nguyễn Văn A",
    "user_email": "nguyenvana@email.com",
    "attempt_number": 1,
    "score": 5,
    "status": "submitted",
    "essay_questions": [
      {
        "question_id": "6699f4391c7ab023b0a77b5c",
        "question_content": "Hãy phân tích ưu điểm của...",
        "text_answer": "Câu trả lời của thí sinh...",
        "is_correct": null,
        "score": null
      }
    ],
    "essay_count": 2,
    "graded_count": 0,
    "pending_count": 2
  }
}
```

### 2. Chấm Điểm Câu Tự Luận

```http
PATCH /api/v1/exam-participant/{id}/essay-score
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "scores": [
    {
      "question_id": "6699f4391c7ab023b0a77b5c",
      "score": 0.75,
      "is_correct": true
    },
    {
      "question_id": "6699f4391c7ab023b0a77b5d",
      "score": 0.5,
      "is_correct": true
    }
  ]
}
```

**Validation Rules:**
- `question_id`: Phải là ObjectId hợp lệ
- `score`: Số từ 0 đến 1 (có thể là số thập phân: 0.25, 0.5, 0.75)
- `is_correct`: Tùy chọn, mặc định `true` nếu `score > 0`

**Response:**
```json
{
  "data": {
    "message": "Chấm điểm thành công",
    "exam": { "name": "Kiểm tra giữa kỳ" },
    "user": { "first_name": "A", "last_name": "Nguyễn Văn" },
    "attempt_number": 1,
    "new_score": 6.25,
    "graded_essays": 2
  }
}
```

## Quy Tắc Chấm Điểm

### Thang Điểm Gợi Ý

| Điểm | Đánh giá |
|------|----------|
| 0 | Sai hoàn toàn / Không trả lời |
| 0.25 | Gần đúng, còn thiếu sót nhiều |
| 0.5 | Khá đúng, còn thiếu sót |
| 0.75 | Đúng, chỉ có lỗi nhỏ |
| 1 | Hoàn toàn đúng |

### Lưu Ý Quan Trọng

1. **Chỉ chấm khi đã nộp bài**: API chỉ cho phép chấm điểm khi `status = "submitted"`
2. **Chấm một lần hoặc cập nhật**: Có thể gọi API nhiều lần để cập nhật điểm
3. **Tính tổng điểm tự động**: Hệ thống tự động tính lại tổng điểm sau mỗi lần chấm
4. **Không bắt buộc chấm hết**: Có thể chấm một phần số câu tự luận

## Ví Dụ Scenarios

### Scenario 1: Bài thi chỉ có câu trắc nghiệm

```
1. Thí sinh nộp bài
2. Hệ thống tự động chấm: 8/10 câu đúng
3. Score = 8
4. Hoàn tất
```

### Scenario 2: Bài thi có cả MC và Essay

```
1. Thí sinh nộp bài
2. Hệ thống tự động chấm MC: 5/8 câu đúng → Score = 5
3. Essay chưa chấm: is_correct = null
4. Admin gọi API chấm 2 câu essay: 0.75 và 0.5
5. Hệ thống tính lại: Score = 5 + 0.75 + 0.5 = 6.25
6. Hoàn tất
```

### Scenario 3: Cập nhật điểm sau khi chấm

```
1. Admin đã chấm câu essay: score = 0.5
2. Sau review, quyết định cập nhật thành 0.75
3. Gọi lại API với score mới
4. Hệ thống tính lại tổng điểm
```

## Schema Dữ Liệu

### ExamParticipantAnswer

```typescript
interface IExamParticipantAnswer {
  question_id: ObjectId;     // ID câu hỏi
  user_answer?: ObjectId;    // ID đáp án chọn (MC)
  text_answer?: string;      // Nội dung trả lời (Essay)
  is_correct?: boolean;      // true/false (MC) | null (Essay chưa chấm)
  score?: number;            // Điểm số (Essay): 0 - 1
}
```

### ExamParticipant

```typescript
interface IExamParticipant {
  exam_id: ObjectId;
  user_id: ObjectId;
  attempt_number: number;
  status: "registered" | "in_progress" | "submitted";
  start_time?: Date;
  submit_time?: Date;
  score?: number;            // Tổng điểm
  time_taken?: number;       // Thời gian làm bài (phút)
  answers: IExamParticipantAnswer[];
}
```

## Error Handling

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| `ID không hợp lệ` | participant_id sai định dạng | Kiểm tra ID là MongoDB ObjectId |
| `Chỉ có thể chấm điểm sau khi thí sinh đã nộp bài` | status ≠ "submitted" | Đợi thí sinh nộp bài |
| `score phải là số từ 0 đến 1` | Điểm ngoài khoảng 0-1 | Nhập điểm trong khoảng cho phép |
| `question_id không hợp lệ` | ID câu hỏi sai định dạng | Kiểm tra question_id |

## Tham Khảo

- Xem thêm: [API_CONTRACT.md](./API_CONTRACT.md) - Chi tiết API endpoints
- Xem thêm: [DB_SCHEMA.md](./DB_SCHEMA.md) - Schema cơ sở dữ liệu
