# API Contract — Cuộc thi trực tuyến "Tìm hiểu về bảo tồn đa dạng sinh học"

> **Version:** 1.0  
> **Base URL:** `https://{domain}/api/v1.0`  
> **Updated:** 27/03/2026  
> **Trạng thái:** Đang phát triển — Phase 1  

---

## Chú thích trạng thái

| Ký hiệu | Ý nghĩa |
|----------|---------|
| ✅ | API đã có, hoạt động |
| ⚠️ | API đã có nhưng **cần sửa** cho yêu cầu mới |
| ❌ | API **chưa có**, cần phát triển |

---

## Response Format Chung

Tất cả response tuân theo cấu trúc sau (từ `ResponseDTO`):

```json
{
  "message": "string | null",
  "message_en": "string | null",
  "responseData": "object | array | null",
  "status": "success | fail",
  "timeStamp": "2026-03-27 10:00:00",
  "violations": "null | [{ code, message, action }]"
}
```

**List response (`responseData` dạng paginated):**
```json
{
  "responseData": {
    "rows": [],
    "count": 100,
    "pageSize": 10,
    "currentPage": 1,
    "totalPages": 10
  }
}
```

**Query parameters chung (áp dụng cho tất cả GET list):**

| Param | Type | Description | Example |
|-------|------|-------------|---------|
| `currentPage` | number | Trang hiện tại | `?currentPage=1` |
| `pageSize` | number | Số bản ghi/trang | `?pageSize=20` |
| `sortField` | string | Trường sort | `?sortField=created_at` |
| `sortOrder` | string | `asc` hoặc `desc` | `?sortOrder=desc` |
| `filters` | string | Bộ lọc theo field | `?filters=is_active==true` |

**Auth Header:**
```
Authorization: Bearer <access_token>
```
(JWT token nhận từ API login hoặc verify OTP)

---

## 1. Authentication

### `POST /auth/login` ✅
Đăng nhập bằng email + password, nhận access token.

**Request:**
```json
{
  "email": "admin@meu-solutions.com",
  "password": "12345678"
}
```

**Validation:**
- `email`: required, email format
- `password`: required, không chứa khoảng trắng, min 8 ký tự

**Response 200:**
```json
{
  "status": "success",
  "message": "Đăng nhập thành công",
  "responseData": {
    "accessToken": "eyJhbGci...",
    "expiresIn": 86400000
  }
}
```

**Errors:** `500` Mật khẩu không chính xác | Tài khoản chưa kích hoạt | Tài khoản đã bị xóa

---

### `POST /auth/register` ✅
Đăng ký tài khoản mới, gửi OTP qua email để xác minh.

> **✅ Đã xong:** Hỗ trợ `profile` object động. Validate theo `profile_schema` từ WebsiteConfig (required, unique, type check...).

**Request (hiện tại):**
```json
{
  "first_name": "Văn A",
  "middle_name": "Văn",
  "last_name": "Nguyễn",
  "email": "nguyen.a@example.com",
  "phone": "0901234567",
  "unit": {
    "district": "Quận 1",
    "ward": "Phường Bến Nghé"
  },
  "password": "12345678"
}
```

**Request (bản cuối — Config-First):**
```json
{
  "first_name": "Văn A",
  "middle_name": "Văn",
  "last_name": "Nguyễn",
  "email": "nguyen.a@example.com",
  "phone": "0901234567",
  "password": "12345678",
  "profile": {
    "identity_number": "079200012345",
    "date_of_birth": "2010-05-15",
    "gender": "Nam",
    "class_name": "10",
    "school_name": "THPT Nguyễn Du",
    "school_address": "Đường Nguyễn Du, Quận 1, TP.HCM"
  }
}
```

**Validation (bản cuối):**
- `first_name`: required, chỉ chữ cái tiếng Việt
- `middle_name`: optional, chỉ chữ cái + khoảng trắng
- `last_name`: required, chỉ chữ cái tiếng Việt
- `email`: required, email format, unique
- `phone`: required, SĐT Việt Nam, unique
- `password`: required, min 8 ký tự, không chứa khoảng trắng
- `profile.*`: validate dynamic theo `profile_schema` trong WebsiteConfig (required, unique, type check...)

**Response 200:** (dev environment trả thêm OTP)
```json
{
  "status": "success",
  "message": "Đăng ký tài khoản thành công",
  "responseData": {
    "otp": "123456"
  }
}
```

**Response 200:** (production — không trả OTP)
```json
{
  "status": "success",
  "responseData": {
    "message": "Đăng ký tài khoản thành công"
  }
}
```

**Errors:** `500` Email đã được đăng ký | SĐT đã được đăng ký | Tài khoản đã bị xóa

---

### `POST /auth/otp/verify` ✅
Xác minh OTP đăng ký, kích hoạt tài khoản và nhận access token.

**Request:**
```json
{
  "email": "nguyen.a@example.com",
  "otp": "123456"
}
```

**Validation:**
- `email`: required, email format
- `otp`: required, numeric, đúng 6 ký tự

**Response 200:**
```json
{
  "status": "success",
  "responseData": {
    "accessToken": "eyJhbGci...",
    "expiresIn": 86400000
  }
}
```

**Errors:** `500` Mã xác minh không chính xác | Mã xác minh đã hết hạn (3 phút)

---

### `POST /auth/otp/resend` ✅
Gửi lại OTP xác minh qua email.

**Request:**
```json
{
  "email": "nguyen.a@example.com"
}
```

**Response 200:**
```json
{
  "status": "success",
  "responseData": {
    "otp": "654321"
  }
}
```

---

### `POST /auth/forgot-password` ✅
Gửi OTP về email để reset password.

**Request:**
```json
{
  "email": "nguyen.a@example.com"
}
```

**Response 200:**
```json
{
  "status": "success",
  "responseData": {
    "message": "Kiểm tra email của bạn để nhận mã đặt lại mật khẩu"
  }
}
```

---

### `POST /auth/reset-password` ✅
🔒 **Yêu cầu auth** — Đặt lại mật khẩu mới.

> Trước khi gọi API này, user cần verify OTP qua `POST /auth/otp/verify` để nhận access token.

**Request:**
```json
{
  "password": "NewPass@123"
}
```

**Validation:**
- `password`: required, min 8 ký tự, không chứa khoảng trắng

**Response 200:**
```json
{
  "status": "success",
  "message": "Đổi mật khẩu thành công",
  "responseData": { "acknowledged": true, "modifiedCount": 1 }
}
```

**Errors:** `500` Mật khẩu mới trùng với mật khẩu cũ

---

## 2. User — Admin Management

### `GET /user` ✅
🔒 **Yêu cầu auth** (Admin)

> **✅ Đã xong:** Trả về đầy đủ `profile` fields. Hỗ trợ filter theo `profile.xxx` (vd: `profile.school_name`, `profile.class_name`).

**Query params:** `currentPage`, `pageSize`, `sortField`, `sortOrder`, `filters`

**Filter examples:**
- `?filters=profile.school_name==THPT Nguyễn Du`
- `?filters=profile.class_name==10,profile.gender==Nam`
- `?filters=profile.identity_number==079200012345`

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Lấy danh sách người dùng thành công",
  "responseData": {
    "rows": [
      {
        "_id": "ObjectId",
        "first_name": "Văn A",
        "middle_name": "Văn",
        "last_name": "Nguyễn",
        "email": "nguyen.a@example.com",
        "phone": "0901234567",
        "profile": {
          "identity_number": "079200012345",
          "date_of_birth": "2010-05-15",
          "gender": "Nam",
          "class_name": "10",
          "school_name": "THPT Nguyễn Du",
          "school_address": "Đường Nguyễn Du, Quận 1, TP.HCM"
        },
        "is_active": true,
        "is_admin": false,
        "is_deleted": false,
        "created_at": "2026-03-27T10:00:00Z"
      }
    ],
    "count": 150,
    "pageSize": 10,
    "currentPage": 1,
    "totalPages": 15
  }
}
```

---

### `GET /user/{id}` ✅
🔒 **Yêu cầu auth** (Admin)

> **✅ Đã xong:** Trả về đầy đủ `profile` fields.

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Lấy thông tin người dùng thành công",
  "responseData": {
    "full_name": "Nguyễn Văn A",
    "email": "nguyen.a@example.com",
    "phone": "0901234567",
    "profile": {
      "identity_number": "079200012345",
      "date_of_birth": "2010-05-15",
      "gender": "Nam",
      "class_name": "10",
      "school_name": "THPT Nguyễn Du",
      "school_address": "Đường Nguyễn Du, Quận 1, TP.HCM"
    },
    "is_admin": false,
    "is_active": true,
    "is_deleted": false,
    "created_at": "2026-03-27T10:00:00Z"
  }
}
```

**Errors:** `500` ID không hợp lệ | Người dùng không tồn tại

---

### `PUT /user/{id}` ✅
🔒 **Yêu cầu auth** (Admin) — Cập nhật thông tin người dùng.

> **✅ Đã xong:** Cho phép cập nhật `profile` fields động.

**Request (bản cuối):**
```json
{
  "first_name": "Văn B",
  "middle_name": "Văn",
  "last_name": "Nguyễn",
  "profile": {
    "class_name": "11",
    "school_name": "THPT Lê Hồng Phong"
  }
}
```

**Response 200:**
```json
{
  "status": "success",
  "message": "Cập nhật thông tin người dùng thành công",
  "responseData": { "message": "Cập nhật thông tin người dùng thành công" }
}
```

---

### `PUT /user/{id}/delete` ✅
🔒 **Yêu cầu auth** (Admin) — Xóa mềm người dùng (soft delete).

**Response 200:**
```json
{
  "status": "success",
  "message": "Xóa người dùng thành công",
  "responseData": { "message": "Xóa người dùng thành công" }
}
```

**Errors:** `500` Người dùng đã bị xóa trước đó

---

## 3. User — Profile & Exam Flow

### `GET /user/myInfo` ✅
🔒 **Yêu cầu auth** — Lấy thông tin tài khoản đang đăng nhập.

> **✅ Đã xong:** Trả về đầy đủ `profile` fields.

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Lấy thông tin tài khoản thành công",
  "responseData": {
    "_id": "ObjectId",
    "full_name": "Nguyễn Văn A",
    "email": "nguyen.a@example.com",
    "phone": "0901234567",
    "profile": {
      "identity_number": "079200012345",
      "date_of_birth": "2010-05-15",
      "gender": "Nam",
      "class_name": "10",
      "school_name": "THPT Nguyễn Du",
      "school_address": "Đường Nguyễn Du, Quận 1, TP.HCM"
    },
    "is_admin": false
  }
}
```

---

### `PUT /user/myInfo` ✅
🔒 **Yêu cầu auth** — Cập nhật thông tin cá nhân.

> **✅ Đã xong:** Cho phép cập nhật `profile` fields động.

**Request (bản cuối):**
```json
{
  "first_name": "Văn B",
  "middle_name": "Văn",
  "last_name": "Nguyễn",
  "profile": {
    "class_name": "11",
    "school_name": "THPT Lê Hồng Phong"
  }
}
```

**Response 200:**
```json
{
  "status": "success",
  "message": "Cập nhật thông tin người dùng thành công",
  "responseData": { "message": "Cập nhật thông tin người dùng thành công" }
}
```

---

### `GET /user/exam` ⚠️
🔒 **Yêu cầu auth** — Danh sách kỳ thi dành cho thí sinh.

> **⚠️ Cần sửa:** Trả thêm `attempts_used`, `attempts_remaining` khi đã tách `ExamParticipant`.

**Query params:** `currentPage`, `pageSize`, `sortField`, `sortOrder`, `filters`

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Lấy danh sách kỳ thi thành công",
  "responseData": {
    "rows": [
      {
        "_id": "ObjectId",
        "name": "Vòng thi tìm hiểu đa dạng sinh học",
        "description": "Cuộc thi trực tuyến Tìm hiểu về bảo tồn đa dạng sinh học",
        "start_time": "2026-05-01T00:00:00Z",
        "end_time": "2026-05-31T23:59:59Z",
        "allowed_time": 20,
        "templates": [
          { "name": "Đề thi chính thức", "question_count": 21 }
        ],
        "is_registered": true,
        "is_submitted": false,
        "attempts_used": 2,
        "attempts_remaining": 3,
        "created_at": "2026-04-01T10:00:00Z"
      }
    ],
    "count": 1,
    "pageSize": 10,
    "currentPage": 1,
    "totalPages": 1
  }
}
```

---

### `PUT /user/exam/{exam_id}/register` ✅
🔒 **Yêu cầu auth** — Đăng ký tham gia kỳ thi.

> **✅ Đã xong:** Tạo `ExamParticipant` document với status `registered` trong collection `exam_participant`.

**Response 200:**
```json
{
  "status": "success",
  "message": "Đăng ký thi thành công",
  "responseData": { "message": "Đăng ký thi thành công" }
}
```

**Errors:** `500` Kỳ thi đã hết hạn đăng ký | Bạn đã đăng ký kỳ thi này trước đó

---

### `PUT /user/exam/{exam_id}/begin` ✅
🔒 **Yêu cầu auth** — Bắt đầu làm bài thi.

> **✅ Đã xong:** 
> - Tạo attempt mới trong `exam_participant` collection
> - Support 3 trạng thái: `registered` → `in_progress` | `in_progress` (tiếp tục) | `submitted` (tạo attempt mới nếu còn lượt)
> - Tự động shuffle questions và lưu vào `questions`
> - Kiểm tra `max_attempts` từ exam

**Request Body (optional):**
```json
{
  "template_id": "ObjectId"
}
```
> Nếu không gửi `template_id`, hệ thống sẽ random chọn 1 đề.

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Bắt đầu làm bài thi thành công",
  "responseData": {
    "participant_id": "ObjectId",
    "attempt_number": 3,
    "attempts_remaining": 2,
    "message": "Bắt đầu làm bài thi thành công"
  }
}
```

**Errors:**
- `500` Kỳ thi chưa diễn ra
- `500` Kỳ thi đã hết hạn
- `500` Bạn chưa đăng ký kỳ thi này
- `500` Bạn đã sử dụng hết số lượt thi cho phép (5 lượt)

---

### `GET /user/exam/{exam_id}/details` ⚠️
🔒 **Yêu cầu auth** — Lấy chi tiết đề thi cho thí sinh (câu hỏi đã shuffle).

> **⚠️ Cần sửa:** Hỗ trợ câu hỏi tự luận (type `ESSAY`); query từ `exam_participant` thay vì Exam.participants.

**Query params (bản cuối):**

| Param | Type | Description |
|-------|------|-------------|
| `attempt_number` | number | Lượt thi cần lấy chi tiết (optional, mặc định = lượt mới nhất) |

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Lấy chi tiết đề thi của thí sinh thành công",
  "responseData": {
    "exam_name": "Vòng thi tìm hiểu đa dạng sinh học",
    "allowed_time": 20,
    "template_name": "Đề thi chính thức",
    "quantity": 21,
    "attempt_number": 3,
    "questions": [
      {
        "_id": "ObjectId",
        "name": "Loài động vật nào sau đây được liệt kê trong Sách đỏ Việt Nam?",
        "type": "MULTIPLE_CHOICE",
        "answers": [
          { "_id": "ObjectId", "value": "Sao la" },
          { "_id": "ObjectId", "value": "Gà rừng" },
          { "_id": "ObjectId", "value": "Chó nhà" },
          { "_id": "ObjectId", "value": "Mèo nhà" }
        ],
        "files": [
          {
            "_id": "ObjectId",
            "file_name": "saola.jpg",
            "original_name": "saola.jpg",
            "mime_type": "image/jpeg",
            "file_path": "/uploads/questions/saola.jpg"
          }
        ]
      },
      {
        "_id": "ObjectId",
        "name": "Hãy nêu ý nghĩa của việc bảo tồn đa dạng sinh học đối với cuộc sống con người.",
        "type": "ESSAY",
        "answers": [],
        "files": null
      }
    ]
  }
}
```

**Errors:** `500` Bạn chưa đăng ký kỳ thi này

---

### `PUT /user/exam/{exam_id}/submit` ✅
🔒 **Yêu cầu auth** — Nộp bài thi.

> **✅ Đã xong:** 
> - Hỗ trợ `text_answer` cho câu tự luận (ESSAY)
> - Lưu vào `exam_participant` document với status `submitted`
> - Tự động tính `score` (số câu trắc nghiệm đúng) và `time_taken` (phút)
> - Validate `attempt_number` và kiểm tra câu hỏi thuộc đề thi
> - Đánh dấu `is_correct` cho câu trắc nghiệm

**Request (bản cuối):**
```json
{
  "start_time": "2026-05-15T09:00:00Z",
  "submit_time": "2026-05-15T09:18:30Z",
  "attempt_number": 3,
  "answers": [
    {
      "question_id": "ObjectId",
      "user_answer": "ObjectId"
    },
    {
      "question_id": "ObjectId",
      "user_answer": ""
    },
    {
      "question_id": "ObjectId",
      "text_answer": "Bảo tồn đa dạng sinh học giúp duy trì cân bằng hệ sinh thái, cung cấp nguồn thực phẩm, dược liệu..."
    }
  ]
}
```

**Validation:**
- `start_time`: required, ISO 8601, phải >= `exam.start_time`
- `submit_time`: required, ISO 8601, phải > `start_time`, phải <= `exam.end_time`
- `attempt_number`: required, integer từ 1-5
- Thời gian làm bài (`submit_time - start_time`) không vượt quá `allowed_time`
- `answers`: required, array, mỗi phần tử phải có `question_id` và (`user_answer` hoặc `text_answer`)

**Response 200:**
```json
{
  "status": "success",
  "message": "Nộp bài thi thành công",
  "responseData": { "message": "Nộp bài thi thành công" }
}
```

**Errors:**
- `500` Bạn chưa đăng ký kỳ thi này
- `500` Bạn chưa bắt đầu bài thi. Không thể nộp bài.
- `500` Bạn đã hoàn thành bài thi. Không thể nộp bài.
- `500` Thời gian làm bài không thể lớn hơn thời gian cho phép.

---

### `GET /user/exam/{exam_id}/result` ✅
🔒 **Yêu cầu auth** — Xem kết quả bài thi.

> **✅ Đã xong:** Query từ `exam_participant` collection. Trả về đầy đủ thông tin câu hỏi, đáp án đúng, và câu trả lời của user.

**Query params (bản cuối):**

| Param | Type | Description |
|-------|------|-------------|
| `attempt_number` | number | Lượt thi cần xem kết quả (1, 2, 3...). Optional, mặc định = lượt mới nhất |
| `currentPage` | number | Trang hiện tại (phân trang câu hỏi) |
| `pageSize` | number | Số câu hỏi/trang |
| `filters` | string | Lọc câu hỏi: `type==MULTIPLE_CHOICE` / `type==ESSAY` / `is_correct==true` / `is_correct==false` / `is_correct==null` |
| `sortField` | string | Trường để sort (ví dụ: `name`, `type`) |
| `sortOrder` | string | Thứ tự sort: `asc` / `desc` |

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Lấy kết quả bài thi của thí sinh thành công",
  "responseData": {
    "_id": "ObjectId",
    "exam_id": { "_id": "ObjectId", "name": "...", "allowed_time": 20 },
    "user_id": "ObjectId",
    "attempt_number": 3,
    "status": "submitted",
    "score": 15,
    "time_taken": 18.5,
    "start_time": "2026-05-15T09:00:00Z",
    "submit_time": "2026-05-15T09:18:30Z",
    // "user_profile": {
    //   "full_name": "Nguyễn Văn A",
    //   "email": "nguyen.a@example.com",
    //   "phone": "0901234567",
    //   "identity_number": "079200012345",
    //   "date_of_birth": "2010-05-15",
    //   "gender": "Nam",
    //   "class_name": "10",
    //   "school_name": "THPT Nguyễn Du",
    //   "school_address": "Đường Nguyễn Du, Quận 1, TP.HCM"
    // },
    "questions": [
      {
        "_id": "ObjectId",
        "name": "...",
        "type": "MULTIPLE_CHOICE",
        "answers": [{ "_id": "...", "value": "...", "is_correct": true }],
        "files": []
      }
    ],
    "answers": [
      { "question_id": "ObjectId", "user_answer": "ObjectId", "is_correct": true },
      { "question_id": "ObjectId", "text_answer": "...", "is_correct": null }
    ],
    "pagination": {
      "count": 21,
      "pageSize": 10,
      "currentPage": 1,
      "totalPages": 3
    }
  }
}
```

**Errors:** `500` Bạn chưa đăng ký kỳ thi này | Bạn chưa nộp bài thi

---

### `GET /user/exam/{exam_id}/attempts` ✅
🔒 **Yêu cầu auth** — Kiểm tra số lượt thi đã dùng / còn lại.

> **✅ Đã xong:** Query từ `exam_participant` collection để đếm số lượt thi.

**Response 200:**
```json
{
  "status": "success",
  "message": "Lấy thông tin lượt thi thành công",
  "responseData": {
    "exam_id": "ObjectId",
    "used": 3,
    "remaining": 2,
    "max": 5
  }
}
```

---

### `GET /user/exam/{exam_id}/history` ✅
🔒 **Yêu cầu auth** — Lịch sử tất cả lượt thi của user trong 1 kỳ thi.

> **✅ Đã xong:** Query từ `exam_participant` collection, sắp xếp theo `attempt_number`.

**Response 200:**
```json
{
  "status": "success",
  "message": "Lấy lịch sử lượt thi thành công",
  "responseData": {
    "exam_name": "Vòng thi tìm hiểu đa dạng sinh học",
    "attempts": [
      {
        "attempt_number": 1,
        "score": 12,
        "time_taken": 19.2,
        "start_time": "2026-05-15T08:00:00Z",
        "submit_time": "2026-05-15T08:19:12Z",
        "status": "submitted"
      },
      {
        "attempt_number": 2,
        "score": 14,
        "time_taken": 17.8,
        "start_time": "2026-05-15T08:25:00Z",
        "submit_time": "2026-05-15T08:42:48Z",
        "status": "submitted"
      },
      {
        "attempt_number": 3,
        "score": null,
        "time_taken": null,
        "start_time": "2026-05-15T09:00:00Z",
        "submit_time": null,
        "status": "in_progress"
      }
    ]
  }
}
```

---

## 4. Exam — Admin Management

### `GET /exam` ✅
🔒 **Yêu cầu auth** — Danh sách kỳ thi (Admin view).

**Query params:** `currentPage`, `pageSize`, `sortField`, `sortOrder`, `filters`

**Response 200:**
```json
{
  "status": "success",
  "message": "Lấy danh sách kỳ thi thành công",
  "responseData": {
    "rows": [
      {
        "_id": "ObjectId",
        "name": "Vòng thi tìm hiểu đa dạng sinh học",
        "description": "Cuộc thi trực tuyến",
        "start_time": "2026-05-01T00:00:00Z",
        "end_time": "2026-05-31T23:59:59Z",
        "allowed_time": 20,
        "templates": [
          { "name": "Đề thi chính thức", "question_count": 21 }
        ],
        "created_by": "ObjectId",
        "updated_by": "ObjectId",
        "created_at": "2026-04-01T10:00:00Z",
        "updated_at": "2026-04-01T10:00:00Z"
      }
    ],
    "count": 5,
    "pageSize": 10,
    "currentPage": 1,
    "totalPages": 1
  }
}
```

---

### `POST /exam` ✅
🔒 **Yêu cầu auth** (Admin) — Tạo kỳ thi mới.

**Request:**
```json
{
  "name": "Vòng thi tìm hiểu đa dạng sinh học",
  "description": "Cuộc thi trực tuyến Tìm hiểu về bảo tồn đa dạng sinh học",
  "start_time": "2026-05-01T00:00:00Z",
  "end_time": "2026-05-31T23:59:59Z",
  "allowed_time": 20
}
```

**Validation:**
- `name`: required, string
- `description`: optional, string
- `start_time`: required, ISO 8601, phải > thời điểm hiện tại
- `end_time`: required, ISO 8601, phải > `start_time`
- `allowed_time`: required, integer > 0 (đơn vị: phút)

**Response 200:**
```json
{
  "status": "success",
  "message": "Tạo kỳ thi thành công",
  "responseData": {
    "_id": "ObjectId",
    "name": "Vòng thi tìm hiểu đa dạng sinh học",
    "description": "...",
    "start_time": "2026-05-01T00:00:00Z",
    "end_time": "2026-05-31T23:59:59Z",
    "allowed_time": 20,
    "created_at": "2026-04-01T10:00:00Z"
  }
}
```

---

### `GET /exam/{id}` ✅
🔒 **Yêu cầu auth** — Chi tiết kỳ thi.

**Query params (phân trang participants):**

| Param | Type | Description |
|-------|------|-------------|
| `participantPage` | number | Trang participants hiện tại (mặc định: 1) |
| `participantPageSize` | number | Số participants/trang (mặc định: 20, max: 100) |

**Response 200:**
```json
{
  "status": "success",
  "message": "Lấy thông tin kỳ thi thành công",
  "responseData": {
    "_id": "ObjectId",
    "name": "Vòng thi tìm hiểu đa dạng sinh học",
    "description": "...",
    "start_time": "2026-05-01T00:00:00Z",
    "end_time": "2026-05-31T23:59:59Z",
    "allowed_time": 20,
    "templates": [
      {
        "_id": "ObjectId",
        "name": "Đề thi chính thức",
        "questions": ["ObjectId", "ObjectId", "..."]
      }
    ],
    "participants": {
      "rows": [
        {
          "user_id": "ObjectId",
          "start_time": "2026-05-15T09:00:00Z",
          "submit_time": "2026-05-15T09:18:30Z",
          "answers": ["..."]
        }
      ],
      "count": 500,
      "pageSize": 20,
      "currentPage": 1,
      "totalPages": 25
    },
    "created_by": "ObjectId",
    "created_at": "2026-04-01T10:00:00Z"
  }
}
```

**Errors:** `500` ID không hợp lệ | Kỳ thi không tồn tại

---

### `PUT /exam/{id}` ✅
🔒 **Yêu cầu auth** (Admin) — Cập nhật kỳ thi (chỉ khi chưa bắt đầu).

**Request:** (subset of POST body, tất cả optional)
```json
{
  "name": "Tên mới",
  "description": "Mô tả mới",
  "start_time": "2026-06-01T00:00:00Z",
  "end_time": "2026-06-30T23:59:59Z",
  "allowed_time": 25
}
```

**Response 200:**
```json
{
  "status": "success",
  "responseData": { "message": "Cập nhật kỳ thi thành công" }
}
```

**Errors:** `500` Không thể chỉnh sửa kỳ thi đã hoặc đang diễn ra

---

### `DELETE /exam/{id}` ✅
🔒 **Yêu cầu auth** (Admin) — Xóa kỳ thi.

**Response 200:**
```json
{
  "status": "success",
  "message": "Xóa kỳ thi thành công",
  "responseData": { "acknowledged": true, "deletedCount": 1 }
}
```

---

### `PUT /exam/{id}/templates` ✅
🔒 **Yêu cầu auth** (Admin) — Tạo đề thi bằng random câu hỏi từ ngân hàng.

> **✅ Đã xong:** Hỗ trợ chọn số lượng câu trắc nghiệm (`quantity`) và câu tự luận (`essay_quantity`).

**Request:**
```json
{
  "name": "Đề thi chính thức",
  "quantity": 20,
  "essay_quantity": 1
}
```

**Validation:**
- `name`: required, string
- `quantity`: required, integer > 0 — số lượng câu hỏi trắc nghiệm (MULTIPLE_CHOICE)
- `essay_quantity`: optional, integer ≥ 0, default 0 — số lượng câu hỏi tự luận (ESSAY)

**Response 200:**
```json
{
  "status": "success",
  "responseData": { "message": "Tạo đề thi thành công" }
}
```

**Errors:** `500` Không thể tạo đề thi cho kỳ thi đã hoặc đang diễn ra | Số lượng câu hỏi không hợp lệ | Không đủ câu hỏi trong ngân hàng

---

### `GET /exam/{id}/templates` ✅ → ⚠️
🔒 **Yêu cầu auth** — Xem chi tiết đề thi (Admin review).

> **⚠️ Cần sửa:** Trả thêm `type` cho mỗi câu hỏi (MULTIPLE_CHOICE / ESSAY).

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Lấy đề thi thành công",
  "responseData": {
    "exam_name": "Vòng thi tìm hiểu đa dạng sinh học",
    "allowed_time": 20,
    "template_name": "Đề thi chính thức",
    "quantity": 21,
    "questions": [
      {
        "_id": "ObjectId",
        "name": "Loài động vật nào sau đây được liệt kê trong Sách đỏ Việt Nam?",
        "type": "MULTIPLE_CHOICE",
        "answers": [
          { "_id": "ObjectId", "value": "Sao la" },
          { "_id": "ObjectId", "value": "Gà rừng" },
          { "_id": "ObjectId", "value": "Chó nhà" },
          { "_id": "ObjectId", "value": "Mèo nhà" }
        ],
        "files": null
      },
      {
        "_id": "ObjectId",
        "name": "Hãy nêu ý nghĩa của việc bảo tồn đa dạng sinh học...",
        "type": "ESSAY",
        "answers": [],
        "files": null
      }
    ]
  }
}
```

---

### `PUT /exam/{id}/templates/{template_id}/shuffle` ✅
🔒 **Yêu cầu auth** (Admin) — Lấy câu hỏi mới từ ngân hàng cho đề thi.

> **✅ Đã có.** Thay thế toàn bộ câu hỏi trong đề thi bằng câu hỏi mới ngẫu nhiên từ ngân hàng câu hỏi, giữ nguyên số lượng câu trắc nghiệm và tự luận.

**Response 200:**
```json
{
  "status": "success",
  "message": "Đổi câu hỏi ngẫu nhiên thành công",
  "responseData": {
    "multiple_choice_count": 20,
    "essay_count": 1,
    "old_questions": ["ObjectId", "ObjectId", "..."],
    "new_questions": ["ObjectId", "ObjectId", "..."]
  }
}
```

**Errors:** `500` Kỳ thi đã hoặc đang diễn ra | Không tìm thấy đề thi | Không đủ câu hỏi trong ngân hàng

---

## 5. Question Bank — Admin Management

### `GET /question-bank` ✅ → ⚠️
🔒 **Yêu cầu auth** (Admin) — Danh sách câu hỏi.

> **⚠️ Cần sửa:** Trả thêm field `type` (MULTIPLE_CHOICE / ESSAY).

**Query params:** `currentPage`, `pageSize`, `sortField`, `sortOrder`, `filters`  
**Common filters:**
- `?filters=level==EASY`
- `?filters=is_deleted==false`
- `?filters=type==MULTIPLE_CHOICE`
- `?filters=type==ESSAY`

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Lấy danh sách câu hỏi thành công",
  "responseData": {
    "rows": [
      {
        "_id": "ObjectId",
        "name": "Loài động vật nào sau đây được liệt kê trong Sách đỏ Việt Nam?",
        "type": "MULTIPLE_CHOICE",
        "level": "EASY",
        "priority": 1,
        "files": [],
        "answers": [
          { "_id": "ObjectId", "value": "Sao la", "is_correct": true },
          { "_id": "ObjectId", "value": "Gà rừng", "is_correct": false },
          { "_id": "ObjectId", "value": "Chó nhà", "is_correct": false },
          { "_id": "ObjectId", "value": "Mèo nhà", "is_correct": false }
        ],
        "is_deleted": false,
        "created_at": "2026-04-01T10:00:00Z"
      },
      {
        "_id": "ObjectId",
        "name": "Hãy nêu ý nghĩa của việc bảo tồn đa dạng sinh học...",
        "type": "ESSAY",
        "level": "HARD",
        "priority": 1,
        "files": [],
        "answers": [],
        "is_deleted": false,
        "created_at": "2026-04-01T10:00:00Z"
      }
    ],
    "count": 200,
    "pageSize": 20,
    "currentPage": 1,
    "totalPages": 10
  }
}
```

---

### `POST /question-bank` ⚠️
🔒 **Yêu cầu auth** (Admin) — Tạo câu hỏi mới.

> **⚠️ Cần sửa:** Thêm field `type`. Câu hỏi `ESSAY` không cần `answers`.

**Request (trắc nghiệm):**
```json
{
  "name": "Loài động vật nào sau đây được liệt kê trong Sách đỏ Việt Nam?",
  "type": "MULTIPLE_CHOICE",
  "level": "EASY",
  "priority": 1,
  "files": [],
  "answers": [
    { "value": "Sao la", "is_correct": true },
    { "value": "Gà rừng", "is_correct": false },
    { "value": "Chó nhà", "is_correct": false },
    { "value": "Mèo nhà", "is_correct": false }
  ]
}
```

**Request (tự luận):**
```json
{
  "name": "Hãy nêu ý nghĩa của việc bảo tồn đa dạng sinh học đối với cuộc sống con người.",
  "type": "ESSAY",
  "level": "HARD",
  "priority": 1,
  "files": []
}
```

**Validation:**
- `name`: required, string
- `type`: required, enum `[MULTIPLE_CHOICE, ESSAY]` (mặc định `MULTIPLE_CHOICE`)
- `level`: required, enum `[EASY, NORMAL, HARD]`
- `priority`: required, number
- `files`: optional, mảng ObjectId (phải tồn tại trong collection file)
- `answers` (MULTIPLE_CHOICE): required, mảng 2–4 phần tử, mỗi phần tử có `value` (string) + `is_correct` (boolean), đúng 1 đáp án correct
- `answers` (ESSAY): optional / ignored

**Response 200:**
```json
{
  "status": "success",
  "message": "Thêm câu hỏi thành công",
  "responseData": {
    "_id": "ObjectId",
    "name": "...",
    "type": "MULTIPLE_CHOICE",
    "level": "EASY",
    "priority": 1,
    "answers": ["..."],
    "created_at": "2026-04-01T10:00:00Z"
  }
}
```

---

### `GET /question-bank/{id}` ✅
🔒 **Yêu cầu auth** (Admin) — Chi tiết câu hỏi.

**Response 200:**
```json
{
  "status": "success",
  "message": "Lấy chi tiết câu hỏi thành công",
  "responseData": {
    "_id": "ObjectId",
    "name": "Loài động vật nào sau đây...",
    "type": "MULTIPLE_CHOICE",
    "level": "EASY",
    "priority": 1,
    "files": [
      {
        "_id": "ObjectId",
        "file_name": "saola.jpg",
        "original_name": "saola.jpg",
        "mime_type": "image/jpeg",
        "file_type": "IMAGE",
        "file_path": "/uploads/questions/saola.jpg",
        "size": 245760
      }
    ],
    "answers": [
      { "_id": "ObjectId", "value": "Sao la", "is_correct": true },
      { "_id": "ObjectId", "value": "Gà rừng", "is_correct": false },
      { "_id": "ObjectId", "value": "Chó nhà", "is_correct": false },
      { "_id": "ObjectId", "value": "Mèo nhà", "is_correct": false }
    ],
    "is_deleted": false,
    "created_by": "ObjectId",
    "created_at": "2026-04-01T10:00:00Z"
  }
}
```

---

### `POST /question-bank/{id}/copy` ✅
🔒 **Yêu cầu auth** (Admin) — Cập nhật câu hỏi bằng cách tạo bản sao mới và đánh dấu bản cũ là đã xóa.

> Pattern copy-on-write: giữ lại bản gốc cho đề thi cũ, đề thi mới sẽ dùng bản mới.

**Request:** Giống body của `POST /question-bank` (tất cả fields bắt buộc).

**Response 200:**
```json
{
  "status": "success",
  "message": "Sao chép và cập nhật câu hỏi thành công",
  "responseData": {
    "_id": "ObjectId (mới)",
    "name": "...",
    "level": "NORMAL",
    "priority": 2,
    "answers": ["..."],
    "created_at": "2026-04-02T10:00:00Z"
  }
}
```

**Errors:** `500` Câu hỏi không tồn tại | Câu hỏi đã bị xóa | Không có thay đổi nào để cập nhật

---

### `PUT /question-bank/{id}/delete` ✅
🔒 **Yêu cầu auth** (Admin) — Xóa mềm câu hỏi.

**Response 200:**
```json
{
  "status": "success",
  "responseData": { "message": "Xóa câu hỏi thành công" }
}
```

**Errors:** `500` Câu hỏi không tồn tại | Câu hỏi đã bị xóa trước đó

---

### `POST /question-bank/import` ❌
🔒 **Yêu cầu auth** (Admin) — Import câu hỏi hàng loạt từ file Excel.

> **❌ Chưa có.** API mới, cho phép import 200 câu hỏi từ file Excel.

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | File (.xlsx) | File Excel chứa danh sách câu hỏi |

**Format file Excel:**

| STT | Câu hỏi | Đáp án A | Đáp án B | Đáp án C | Đáp án D | Đáp án đúng | Loại | Độ khó |
|-----|---------|----------|----------|----------|----------|-------------|------|--------|
| 1 | Loài nào trong Sách đỏ? | Sao la | Gà rừng | Chó nhà | Mèo nhà | A | MULTIPLE_CHOICE | EASY |
| 2 | Nêu ý nghĩa bảo tồn... | | | | | | ESSAY | HARD |

**Response 200:**
```json
{
  "status": "success",
  "message": "Import câu hỏi thành công",
  "responseData": {
    "total": 200,
    "imported": 198,
    "failed": 2,
    "errors": [
      { "row": 45, "message": "Thiếu đáp án đúng" },
      { "row": 120, "message": "Tên câu hỏi trống" }
    ]
  }
}
```

---

## 6. File Management

### `GET /file` ✅
🔒 **Yêu cầu auth** (Admin) — Danh sách file đã upload.

**Query params:** `currentPage`, `pageSize`, `sortField`, `sortOrder`, `filters`  
**Common filters:**
- `?filters=file_type==IMAGE`
- `?filters=file_type==VIDEO`
- `?filters=file_type==DOCUMENT`

**Response 200:**
```json
{
  "status": "success",
  "message": "Lấy danh sách file thành công",
  "responseData": {
    "rows": [
      {
        "_id": "ObjectId",
        "file_name": "abc123.jpg",
        "original_name": "banner-cuoc-thi.jpg",
        "mime_type": "image/jpeg",
        "file_type": "IMAGE",
        "file_path": "/uploads/images/abc123.jpg",
        "size": 524288,
        "created_by": "ObjectId",
        "created_at": "2026-04-01T10:00:00Z"
      }
    ],
    "count": 30,
    "pageSize": 10,
    "currentPage": 1,
    "totalPages": 3
  }
}
```

---

### `POST /file/upload` ✅
🔒 **Yêu cầu auth** (Admin) — Upload file (hỗ trợ ảnh + video + document).

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | File cần upload (ảnh, video, document) |

> File sẽ được nén tự động theo các kích thước: desktop, tablet, mobile, preview, preload (ảnh).

**Response 200:**
```json
{
  "status": "success",
  "message": "Upload file thành công",
  "responseData": {
    "_id": "ObjectId",
    "file_name": "abc123.jpg",
    "original_name": "banner-cuoc-thi.jpg",
    "mime_type": "image/jpeg",
    "file_type": "IMAGE",
    "file_path": "/uploads/images/abc123.jpg",
    "size": 524288,
    "created_at": "2026-04-01T10:00:00Z"
  }
}
```

**Errors:** `500` Vui lòng chọn file cần upload

---

### `GET /file/{id}` ✅
🔒 **Yêu cầu auth** — Chi tiết file.

**Response 200:**
```json
{
  "status": "success",
  "message": "Lấy thông tin file thành công",
  "responseData": {
    "_id": "ObjectId",
    "file_name": "abc123.jpg",
    "original_name": "banner-cuoc-thi.jpg",
    "mime_type": "image/jpeg",
    "file_type": "IMAGE",
    "file_path": "/uploads/images/abc123.jpg",
    "size": 524288,
    "created_by": "ObjectId",
    "created_at": "2026-04-01T10:00:00Z"
  }
}
```

**Errors:** `500` File không tồn tại

---

### `DELETE /file/{id}` ✅
🔒 **Yêu cầu auth** (Admin) — Xóa file (xóa trên disk + DB).

**Response 200:**
```json
{
  "status": "success",
  "message": "Xóa file thành công",
  "responseData": { "acknowledged": true, "deletedCount": 1 }
}
```

---

## 7. Website Config

### `GET /website-config` ✅
**Không yêu cầu auth** — Lấy cấu hình website (public).

> **✅ Đã xong:** Trả về đầy đủ `banners[]`, `guide_video`, `profile_schema`, `exam_rules`, `unit_schema`.

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Lấy thông tin website thành công",
  "responseData": {
    "name": "Cuộc thi bảo tồn đa dạng sinh học",
    "phone": "0281234567",
    "email": "cuocthi@example.com",
    "website": "https://cuocthi.example.com",
    "address": "123 Đường ABC, Quận 1, TP.HCM",
    "logo": {
      "_id": "ObjectId",
      "file_name": "logo.png",
      "original_name": "logo.png",
      "mime_type": "image/png",
      "file_type": "IMAGE",
      "file_path": "/uploads/images/logo.png",
      "size": 51200
    },
    "banners": [
      {
        "_id": "ObjectId",
        "file_name": "banner1.jpg",
        "original_name": "banner-cuoc-thi-1.jpg",
        "mime_type": "image/jpeg",
        "file_type": "IMAGE",
        "file_path": "/uploads/images/banner1.jpg",
        "size": 524288
      },
      {
        "_id": "ObjectId",
        "file_name": "banner2.jpg",
        "original_name": "banner-cuoc-thi-2.jpg",
        "mime_type": "image/jpeg",
        "file_type": "IMAGE",
        "file_path": "/uploads/images/banner2.jpg",
        "size": 409600
      }
    ],
    "guide_video": {
      "_id": "ObjectId",
      "file_name": "huongdan.mp4",
      "original_name": "huong-dan-thi.mp4",
      "mime_type": "video/mp4",
      "file_type": "VIDEO",
      "file_path": "/uploads/videos/huongdan.mp4",
      "size": 10485760
    },
    "theme": "green",
    "profile_schema": [
      { "key": "identity_number", "label": "Số CCCD", "type": "text", "required": true, "unique": true },
      { "key": "date_of_birth", "label": "Ngày sinh", "type": "date", "required": true },
      { "key": "gender", "label": "Giới tính", "type": "select", "options": ["Nam", "Nữ", "Khác"], "required": true },
      { "key": "class_name", "label": "Lớp", "type": "text", "required": true },
      { "key": "school_name", "label": "Trường học", "type": "text", "required": true },
      { "key": "school_address", "label": "Địa chỉ trường", "type": "text", "required": false }
    ],
    "exam_rules": {
      "max_attempts": 5,
      "time_minutes": 20,
      "question_config": [
        { "type": "MULTIPLE_CHOICE", "count": 20 },
        { "type": "ESSAY", "count": 1 }
      ],
      "essay_grading": "manual"
    },
    "unit_schema": {
      "group_by_field": "profile.school_name",
      "group_label": "Trường học",
      "classification_field": "profile.class_name",
      "classification_rules": [
        { "label": "THCS", "pattern": "^[6-9]$" },
        { "label": "THPT", "pattern": "^(10|11|12)$" }
      ]
    }
  }
}
```

---

### `PUT /website-config` ✅
🔒 **Yêu cầu auth** (Admin) — Cập nhật cấu hình website.

> **✅ Đã xong:** Hỗ trợ cập nhật đầy đủ `banners[]`, `guide_video`, `profile_schema`, `exam_rules`, `unit_schema`.

**Request (bản cuối):**
```json
{
  "name": "Cuộc thi bảo tồn đa dạng sinh học",
  "phone": "0281234567",
  "email": "cuocthi@example.com",
  "website": "https://cuocthi.example.com",
  "address": "123 Đường ABC, Quận 1, TP.HCM",
  "logo": "ObjectId (file_id)",
  "banners": ["ObjectId", "ObjectId"],
  "guide_video": "ObjectId (file_id)",
  "theme": "green",
  "profile_schema": [
    { "key": "identity_number", "label": "Số CCCD", "type": "text", "required": true, "unique": true },
    { "key": "date_of_birth", "label": "Ngày sinh", "type": "date", "required": true },
    { "key": "gender", "label": "Giới tính", "type": "select", "options": ["Nam", "Nữ", "Khác"], "required": true },
    { "key": "class_name", "label": "Lớp", "type": "text", "required": true },
    { "key": "school_name", "label": "Trường học", "type": "text", "required": true },
    { "key": "school_address", "label": "Địa chỉ trường", "type": "text", "required": false }
  ],
  "exam_rules": {
    "max_attempts": 5,
    "time_minutes": 20,
    "question_config": [
      { "type": "MULTIPLE_CHOICE", "count": 20 },
      { "type": "ESSAY", "count": 1 }
    ],
    "essay_grading": "manual"
  },
  "unit_schema": {
    "group_by_field": "profile.school_name",
    "group_label": "Trường học",
    "classification_field": "profile.class_name",
    "classification_rules": [
      { "label": "THCS", "pattern": "^[6-9]$" },
      { "label": "THPT", "pattern": "^(10|11|12)$" }
    ]
  }
}
```

**Validation:**
- `email`: optional, email format
- `logo`, `guide_video`: optional, ObjectId phải tồn tại trong collection file
- `banners`: optional, mảng ObjectId (mỗi ID phải tồn tại trong collection file)

**Response 200:**
```json
{
  "status": "success",
  "message": "Cập nhật thông tin website thành công",
  "responseData": { "message": "Cập nhật thông tin website thành công" }
}
```

---

## 8. Statistics

### `GET /statistics/exam/{exam_id}/participant` ⚠️
🔒 **Yêu cầu auth** (Admin) — Thống kê theo thí sinh.

> **⚠️ Cần sửa:** Trả thêm profile fields (CCCD, trường, lớp...); tính điểm cao nhất / thời gian thấp nhất trong nhiều lượt; phân loại THCS/THPT.

**Query params:**

| Param | Type | Description | Example |
|-------|------|-------------|---------|
| `filters` | string | Bộ lọc | `?filters=school_name==THPT Nguyễn Du` |
| `pageSize` | number | Số bản ghi/trang | `?pageSize=20` |
| `currentPage` | number | Trang hiện tại | `?currentPage=1` |
| `sortBy` | string | Sort criteria (multi-field) | `?sortBy=correct_count,desc;time_taken,asc` |

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Lấy kết quả thống kê thành công",
  "responseData": {
    "rows": [
      {
        "_id": "ObjectId",
        "first_name": "Văn A",
        "middle_name": "Văn",
        "last_name": "Nguyễn",
        "identity_number": "079200012345",
        "date_of_birth": "2010-05-15",
        "gender": "Nam",
        "class_name": "10",
        "school_name": "THPT Nguyễn Du",
        "school_address": "Quận 1, TP.HCM",
        "phone": "0901234567",
        "classification": "THPT",
        "total_attempts": 3,
        "best_score": 18,
        "best_time_taken": 15.3,
        "best_submit_time": "2026-05-15T09:15:18Z",
        "rank": 1
      }
    ],
    "count": 500,
    "totalPages": 25,
    "currentPage": 1
  }
}
```

---

### `GET /statistics/exam/{exam_id}/participant/{participant_id}` ⚠️
🔒 **Yêu cầu auth** (Admin) — Thống kê chi tiết 1 thí sinh.

> **⚠️ Cần sửa:** Trả thêm profile fields.

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Lấy kết quả thống kê thành công",
  "responseData": {
    "_id": "ObjectId",
    "first_name": "Văn A",
    "middle_name": "Văn",
    "last_name": "Nguyễn",
    "identity_number": "079200012345",
    "date_of_birth": "2010-05-15",
    "gender": "Nam",
    "class_name": "10",
    "school_name": "THPT Nguyễn Du",
    "school_address": "Quận 1, TP.HCM",
    "phone": "0901234567",
    "classification": "THPT",
    "total_attempts": 3,
    "best_score": 18,
    "best_time_taken": 15.3,
    "attempts": [
      { "attempt_number": 1, "score": 12, "time_taken": 19.2, "submit_time": "2026-05-15T08:20:00Z" },
      { "attempt_number": 2, "score": 14, "time_taken": 17.8, "submit_time": "2026-05-15T08:45:00Z" },
      { "attempt_number": 3, "score": 18, "time_taken": 15.3, "submit_time": "2026-05-15T09:15:18Z" }
    ]
  }
}
```

---

### `GET /statistics/exam/{exam_id}/participant/export` ⚠️
🔒 **Yêu cầu auth** (Admin) — Xuất thống kê thí sinh ra file Excel.

> **⚠️ Cần sửa:** Thêm tất cả columns mới; tách sheet THCS/THPT; điểm cao nhất + thời gian thấp nhất.

**Query params:** Giống `GET /statistics/exam/{exam_id}/participant`

**Response:** File Excel (`.xlsx`)
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename=ThongKeTheoCaNhan.xlsx
```

**Columns Excel (bản cuối):**

| STT | Họ và tên | Số CCCD | Ngày sinh | Giới tính | Lớp | Trường học | Địa chỉ trường | SĐT | Số lượt thi | Điểm cao nhất | Thời gian (phút:giây) | Ngày thi (điểm cao nhất) |
|-----|-----------|---------|-----------|-----------|-----|-----------|----------------|-----|------------|--------------|----------------------|-------------------------|

> File có 2 sheet riêng: **THCS** và **THPT** (phân loại dựa theo `class_name` và `classification_rules` từ WebsiteConfig).

---

### `GET /statistics/exam/{exam_id}/unit` ⚠️
🔒 **Yêu cầu auth** (Admin) — Thống kê theo đơn vị (trường học).

> **⚠️ Cần sửa:** Group by đọc từ `unit_schema.group_by_field` thay vì hardcode `district`.

**Query params:**

| Param | Type | Description | Example |
|-------|------|-------------|---------|
| `filters` | string | Bộ lọc | `?filters=school_name==THPT Nguyễn Du` |
| `pageSize` | number | Số bản ghi/trang | `?pageSize=20` |
| `currentPage` | number | Trang hiện tại | `?currentPage=1` |
| `sortBy` | string | Sort criteria | `?sortBy=participant_count,desc` |

**Response 200 (bản cuối):**
```json
{
  "status": "success",
  "message": "Lấy kết quả thống kê thành công",
  "responseData": {
    "rows": [
      {
        "unit_name": "THPT Nguyễn Du",
        "unit_address": "Quận 1, TP.HCM",
        "participant_count": 120,
        "total_correct_count": 1800,
        "avg_correct_count": 15.0,
        "total_time_taken": 2100.5,
        "avg_time_taken": 17.5,
        "rank": 1
      },
      {
        "unit_name": "THCS Trần Hưng Đạo",
        "unit_address": "Quận 3, TP.HCM",
        "participant_count": 95,
        "total_correct_count": 1200,
        "avg_correct_count": 12.6,
        "total_time_taken": 1710.0,
        "avg_time_taken": 18.0,
        "rank": 2
      }
    ],
    "count": 50,
    "totalPages": 3,
    "currentPage": 1
  }
}
```

---

### `GET /statistics/exam/{exam_id}/unit/export` ⚠️
🔒 **Yêu cầu auth** (Admin) — Xuất thống kê theo đơn vị ra file Excel.

> **⚠️ Cần sửa:** Columns đọc từ `unit_schema`; highlight đơn vị top.

**Response:** File Excel (`.xlsx`)
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename=ThongKeTheoDonVi.xlsx
```

**Columns Excel (bản cuối):**

| STT | Trường học | Địa chỉ | Số lượt tham gia | Tổng điểm đúng | Điểm TB | Tổng thời gian (phút) | Thời gian TB |
|-----|-----------|---------|-----------------|----------------|---------|----------------------|-------------|

---

### `GET /statistics/total-participants` ❌
**Không yêu cầu auth** — API public đếm tổng lượt tham gia cuộc thi.

> **❌ Chưa có.** Hiển thị counter trên góc website.

**Response 200:**
```json
{
  "status": "success",
  "message": "Lấy tổng số lượt tham gia thành công",
  "responseData": {
    "total_participants": 15230,
    "total_attempts": 42500
  }
}
```

---

## 9. Content Page (CMS) ❌

> **❌ Toàn bộ module chưa có.** Quản lý nội dung trang: thể lệ, tài liệu tham khảo, thông báo kết quả, liên hệ...

> **Type values:** `exam_rules` | `reference_docs` | `results` | `contact` | `announcement`

### `GET /content-page` ❌
🔒 **Yêu cầu auth** (Admin) — Danh sách trang nội dung.

**Query params:** `currentPage`, `pageSize`, `sortField`, `sortOrder`, `filters`  
**Common filters:**
- `?filters=type==exam_rules`
- `?filters=is_active==true`

**Response 200:**
```json
{
  "status": "success",
  "message": "Lấy danh sách trang nội dung thành công",
  "responseData": {
    "rows": [
      {
        "_id": "ObjectId",
        "title": "Thể lệ cuộc thi",
        "slug": "the-le-cuoc-thi",
        "type": "exam_rules",
        "content": "<h1>Thể lệ cuộc thi</h1><p>...</p>",
        "sort_order": 1,
        "is_active": true,
        "files": [
          {
            "_id": "ObjectId",
            "file_name": "thelecuocthi.pdf",
            "original_name": "The-le-cuoc-thi.pdf",
            "file_type": "DOCUMENT"
          }
        ],
        "created_by": "ObjectId",
        "created_at": "2026-04-01T10:00:00Z",
        "updated_at": "2026-04-05T14:00:00Z"
      }
    ],
    "count": 5,
    "pageSize": 10,
    "currentPage": 1,
    "totalPages": 1
  }
}
```

---

### `POST /content-page` ❌
🔒 **Yêu cầu auth** (Admin) — Tạo trang nội dung mới.

**Request:**
```json
{
  "title": "Thể lệ cuộc thi",
  "slug": "the-le-cuoc-thi",
  "type": "exam_rules",
  "content": "<h1>Thể lệ cuộc thi</h1><p>Cuộc thi được tổ chức...</p>",
  "sort_order": 1,
  "is_active": true,
  "files": ["ObjectId"]
}
```

**Validation:**
- `title`: required, string, min 1, max 255
- `slug`: required, string, unique, URL-safe
- `type`: required, enum `[exam_rules, reference_docs, results, contact, announcement]`
- `content`: required, string (HTML)
- `sort_order`: optional, number, default 0
- `is_active`: optional, boolean, default true
- `files`: optional, mảng ObjectId

**Response 200:**
```json
{
  "status": "success",
  "message": "Tạo trang nội dung thành công",
  "responseData": { "_id": "ObjectId", "title": "Thể lệ cuộc thi", "slug": "the-le-cuoc-thi" }
}
```

---

### `GET /content-page/{id}` ❌
🔒 **Yêu cầu auth** (Admin)

**Response 200:** Trả về object content page (cùng schema với row trong list).  
**Response 500:** Trang nội dung không tồn tại.

---

### `PUT /content-page/{id}` ❌
🔒 **Yêu cầu auth** (Admin) — Cập nhật trang nội dung. Tất cả fields optional.

**Request:** (subset của POST body)
```json
{
  "title": "Thể lệ cuộc thi (Cập nhật)",
  "content": "<h1>Thể lệ cuộc thi - Phiên bản mới</h1>...",
  "is_active": true
}
```

**Response 200:**
```json
{
  "status": "success",
  "message": "Cập nhật trang nội dung thành công",
  "responseData": { "message": "Cập nhật trang nội dung thành công" }
}
```

---

### `DELETE /content-page/{id}` ❌
🔒 **Yêu cầu auth** (Admin)

**Response 200:**
```json
{
  "status": "success",
  "message": "Xóa trang nội dung thành công",
  "responseData": { "acknowledged": true, "deletedCount": 1 }
}
```

---

### `GET /content-page/public` ❌
**Không yêu cầu auth** — Lấy danh sách trang nội dung public (cho FE user).

**Query params:**

| Param | Type | Description | Example |
|-------|------|-------------|---------|
| `type` | string | Lọc theo loại trang | `?type=exam_rules` |

**Response 200:**
```json
{
  "status": "success",
  "message": "Lấy danh sách trang nội dung thành công",
  "responseData": [
    {
      "_id": "ObjectId",
      "title": "Thể lệ cuộc thi",
      "slug": "the-le-cuoc-thi",
      "type": "exam_rules",
      "content": "<h1>Thể lệ cuộc thi</h1><p>...</p>",
      "sort_order": 1,
      "files": [
        {
          "_id": "ObjectId",
          "file_name": "thelecuocthi.pdf",
          "original_name": "The-le-cuoc-thi.pdf",
          "file_type": "DOCUMENT",
          "file_path": "/uploads/documents/thelecuocthi.pdf"
        }
      ]
    }
  ]
}
```

---

## 10. Logs

### `GET /logs/getAllWithinTimeRange` ✅
🔒 **Yêu cầu auth** — Lấy log hệ thống theo khoảng thời gian.

**Query params:**

| Param | Type | Description | Example |
|-------|------|-------------|---------|
| `from` | string | Ngày bắt đầu (DDMMYYYY) | `?from=01042026` |
| `to` | string | Ngày kết thúc (DDMMYYYY) | `?to=30042026` |

**Response 200:**
```json
{
  "status": "success",
  "message": "Lấy log thành công",
  "responseData": [
    {
      "date": "01042026",
      "logs": ["..."]
    }
  ]
}
```

---

## Tổng hợp trạng thái API

| # | Module | Endpoint | Method | Status | Ghi chú |
|---|--------|----------|--------|--------|---------|
| 1 | Auth | `/auth/login` | POST | ✅ | |
| 2 | Auth | `/auth/register` | POST | ⚠️ | Thêm profile fields |
| 3 | Auth | `/auth/otp/verify` | POST | ✅ | |
| 4 | Auth | `/auth/otp/resend` | POST | ✅ | |
| 5 | Auth | `/auth/forgot-password` | POST | ✅ | |
| 6 | Auth | `/auth/reset-password` | POST | ✅ | |
| 7 | User | `/user` | GET | ⚠️ | Thêm profile fields |
| 8 | User | `/user/{id}` | GET | ⚠️ | Thêm profile fields |
| 9 | User | `/user/{id}` | PUT | ⚠️ | Thêm profile fields |
| 10 | User | `/user/{id}/delete` | PUT | ✅ | |
| 11 | User | `/user/myInfo` | GET | ⚠️ | Thêm profile fields |
| 12 | User | `/user/myInfo` | PUT | ⚠️ | Thêm profile fields |
| 13 | User | `/user/exam` | GET | ⚠️ | Thêm attempts info |
| 14 | User | `/user/exam/{exam_id}/register` | PUT | ✅ | Tách ExamParticipant |
| 15 | User | `/user/exam/{exam_id}/begin` | PUT | ✅ | Nhiều lượt thi |
| 16 | User | `/user/exam/{exam_id}/details` | GET | ⚠️ | Thêm câu tự luận |
| 17 | User | `/user/exam/{exam_id}/submit` | PUT | ✅ | Tính điểm MC + text_answer |
| 18 | User | `/user/exam/{exam_id}/result` | GET | ✅ | Profile user + chi tiết đúng/sai |
| 19 | User | `/user/exam/{exam_id}/attempts` | GET | ✅ | Số lượt thi đã dùng/còn lại |
| 20 | User | `/user/exam/{exam_id}/history` | GET | ✅ | Lịch sử tất cả lượt thi |
| 21 | Exam | `/exam` | GET | ✅ | |
| 22 | Exam | `/exam` | POST | ✅ | |
| 23 | Exam | `/exam/{id}` | GET | ✅ | |
| 24 | Exam | `/exam/{id}` | PUT | ✅ | |
| 25 | Exam | `/exam/{id}` | DELETE | ✅ | |
| 26 | Exam | `/exam/{id}/templates` | PUT | ⚠️ | Config-driven question count |
| 27 | Exam | `/exam/{id}/templates` | GET | ⚠️ | Thêm type field |
| 28 | Exam | `/exam/{id}/templates/{template_id}/shuffle` | PUT | ✅ | Random lại câu hỏi trong đề thi |
| 29 | QB | `/question-bank` | GET | ⚠️ | Thêm type field |
| 30 | QB | `/question-bank` | POST | ⚠️ | Thêm type, hỗ trợ ESSAY |
| 31 | QB | `/question-bank/{id}` | GET | ✅ | |
| 32 | QB | `/question-bank/{id}/copy` | POST | ✅ | |
| 33 | QB | `/question-bank/{id}/delete` | PUT | ✅ | |
| 34 | QB | `/question-bank/import` | POST | ❌ | **Mới** — Import Excel |
| 35 | File | `/file` | GET | ✅ | |
| 36 | File | `/file/upload` | POST | ✅ | |
| 37 | File | `/file/{id}` | GET | ✅ | |
| 38 | File | `/file/{id}` | DELETE | ✅ | |
| 39 | Config | `/website-config` | GET | ⚠️ | Mở rộng fields |
| 40 | Config | `/website-config` | PUT | ⚠️ | Mở rộng fields |
| 41 | Stats | `/statistics/exam/{id}/participant` | GET | ⚠️ | Nhiều lượt, profile fields |
| 42 | Stats | `/statistics/exam/{id}/participant/{pid}` | GET | ⚠️ | Profile fields |
| 43 | Stats | `/statistics/exam/{id}/participant/export` | GET | ⚠️ | Tách THCS/THPT |
| 44 | Stats | `/statistics/exam/{id}/unit` | GET | ⚠️ | Config-driven group by |
| 45 | Stats | `/statistics/exam/{id}/unit/export` | GET | ⚠️ | Config-driven columns |
| 46 | Stats | `/statistics/total-participants` | GET | ❌ | **Mới** — Public counter |
| 47 | CMS | `/content-page` | GET | ❌ | **Mới** |
| 48 | CMS | `/content-page` | POST | ❌ | **Mới** |
| 49 | CMS | `/content-page/{id}` | GET | ❌ | **Mới** |
| 50 | CMS | `/content-page/{id}` | PUT | ❌ | **Mới** |
| 51 | CMS | `/content-page/{id}` | DELETE | ❌ | **Mới** |
| 52 | CMS | `/content-page/public` | GET | ❌ | **Mới** — Public |
| 53 | Logs | `/logs/getAllWithinTimeRange` | GET | ✅ | |

---

**Tổng:** 53 endpoints | ✅ 22 hoạt động | ⚠️ 20 cần sửa | ❌ 11 chưa có
