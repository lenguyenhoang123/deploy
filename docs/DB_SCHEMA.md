# Database Schema — SHTT Online Exam

> **Database:** MongoDB  
> **ODM:** Mongoose 8.x  
> **Updated:** 30/03/2026  

---

## Chú thích trạng thái

| Ký hiệu | Ý nghĩa |
|----------|---------|
| ✅ | Field/Collection đã có |
| ⚠️ | Field đã có nhưng **cần sửa** |
| ❌ | Field/Collection **chưa có**, cần tạo mới |
| 🔑 | Primary Key (`_id`) |
| 🔗 | Foreign Key (ObjectId ref) |
| 📇 | Index |

---

## Diagram tổng quan

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     user     │◄────│    user_auth     │     │       file       │
│              │     │                  │     │                  │
│ _id 🔑      │     │ user 🔗→user     │     │ _id 🔑          │
│ email 📇    │     │ auth_key         │     │ file_name 📇    │
│ phone 📇    │     │ auth_method      │     │ file_path        │
└──────┬───────┘     └──────────────────┘     └────────┬─────────┘
       │                                               │
       │  ┌──────────────────┐                         │
       │  │      exam        │                         │
       │  │                  │                         │
       │  │ _id 🔑          │     ┌──────────────────┐ │
       │  │ template.        │     │  question_bank   │ │
       │  │   questions 🔗──│────►│                  │─┘
       │  │ participants[]   │     │ _id 🔑          │ files 🔗→file
       │  │   user_id 🔗────│─┐   │ answers[]        │
       │  └──────────────────┘ │   └──────────────────┘
       │                       │
       │  ┌──────────────────┐ │   ┌──────────────────┐
       └──│ exam_participant │◄┘   │  website_config  │
    ✅    │      (MỚI)       │     │                  │
          │ user_id 🔗→user  │     │ logo 🔗→file    │
          │ exam_id 🔗→exam  │     │ banners 🔗→file │ ✅
          └──────────────────┘     └──────────────────┘

                                   ┌──────────────────┐
                                   │  content_page    │ ✅
                                   │      (MỚI)       │
                                   │ files 🔗→file   │
                                   └──────────────────┘
```

---

## 1. Collection: `user` ✅

> Thông tin người dùng (thí sinh + admin).

| Field | Type | Required | Default | Unique | Validation | Status | Ghi chú |
|-------|------|----------|---------|--------|------------|--------|---------|
| `_id` | ObjectId | auto | — | ✅ | — | ✅ | 🔑 PK |
| `first_name` | String | ✅ | — | — | trim, capitalize | ✅ | Tên |
| `middle_name` | String | — | — | — | trim, capitalize | ✅ | Tên đệm |
| `last_name` | String | ✅ | — | — | trim, capitalize | ✅ | Họ |
| `email` | String | ✅ | — | ✅ 📇 | lowercase, `isEmail` | ✅ | |
| `phone` | String | ✅ | — | ✅ 📇 | `isMobilePhone('vi-VN')` | ✅ | |
| `unit.district` | String | — | — | — | — | ⚠️ | Sẽ bỏ, thay bằng `profile` |
| `unit.ward` | String | — | — | — | — | ⚠️ | Sẽ bỏ, thay bằng `profile` |
| `profile` | Mixed | — | — | — | Validate dynamic theo `profile_schema` | ✅ | **MỚI** — Xem chi tiết bên dưới |
| `is_admin` | Boolean | — | `false` | — | — | ✅ | |
| `is_active` | Boolean | — | `false` | — | — | ✅ | `true` sau khi verify OTP |
| `is_deleted` | Boolean | — | `false` | — | — | ✅ | Soft delete |
| `created_by` | ObjectId | — | — | — | 🔗 ref `user` | ✅ | |
| `updated_by` | ObjectId | — | — | — | 🔗 ref `user` | ✅ | |
| `created_at` | Date | auto | — | — | timestamps | ✅ | |
| `updated_at` | Date | auto | — | — | timestamps | ✅ | |

**Methods:**
- `full_name()`: Returns `"last_name middle_name first_name"`

**Pre-save hooks:**
- `capitalizeFirstLetter` cho `first_name`, `last_name`, `middle_name`

### ✅ Field mới: `profile` (Mixed / SchemaType.Mixed)

> Dữ liệu bổ sung, validate dynamic theo `profile_schema` trong `WebsiteConfig`.

```json
{
  "identity_number": "079200012345",
  "date_of_birth": "2010-05-15",
  "gender": "Nam",
  "class_name": "10",
  "school_name": "THPT Nguyễn Du",
  "school_address": "Đường Nguyễn Du, Quận 1, TP.HCM"
}
```

**Indexes cần tạo thêm:**
- `profile.identity_number`: unique, sparse (✅)

---

## 2. Collection: `user_auth` ✅

> Lưu mật khẩu và OTP cho mỗi user. Mỗi user có thể có nhiều auth records (1 PASSWORD + N OTP).

| Field | Type | Required | Default | Validation | Status | Ghi chú |
|-------|------|----------|---------|------------|--------|---------|
| `_id` | ObjectId | auto | — | — | ✅ | 🔑 PK |
| `user` | ObjectId | ✅ | — | 🔗 ref `user` | ✅ | |
| `auth_key` | String | ✅ | — | Auto-hash bằng bcrypt | ✅ | Password hoặc OTP (đã hash) |
| `auth_method` | String | ✅ | — | enum `[PASSWORD, OTP]` | ✅ | |
| `created_at` | Date | auto | — | timestamps | ✅ | |
| `updated_at` | Date | auto | — | timestamps | ✅ | |

**Methods:**
- `hashKey(key)`: Hash bằng bcrypt (genSalt + hash)
- `compareKey(key)`: So sánh plaintext với hash

**Pre-save hooks:**
- `save`: Auto-hash `auth_key`
- `insertMany`: Auto-hash tất cả `auth_key`
- `updateOne`: Auto-hash `auth_key` nếu có trong update payload

**Business rules:**
- OTP gồm 6 chữ số, hết hạn sau **3 phút** (check bằng `created_at + 3min`)
- Khi verify OTP thành công → xóa record OTP, activate user

---

## 3. Collection: `exam` ✅

> Kỳ thi. Chứa template (đề thi) và danh sách thí sinh (embedded).

| Field | Type | Required | Default | Validation | Status | Ghi chú |
|-------|------|----------|---------|------------|--------|---------|
| `_id` | ObjectId | auto | — | — | ✅ | 🔑 PK |
| `name` | String | ✅ | — | — | ✅ | Tên kỳ thi |
| `description` | String | — | — | — | ✅ | |
| `start_time` | Date | ✅ | — | ISO 8601, phải > now | ✅ | Thời gian bắt đầu |
| `end_time` | Date | ✅ | — | ISO 8601, phải > `start_time` | ✅ | Thời gian kết thúc |
| `allowed_time` | Number | ✅ | — | integer, min 1 (phút) | ✅ | Thời gian làm bài |
| `template` | Object | — | — | — | ✅ | Đề thi (xem sub-schema) |
| `participants` | Array | — | `[]` | — | ⚠️ | Sẽ tách ra `exam_participant` |
| `created_by` | ObjectId | — | — | 🔗 ref `user` | ✅ | |
| `updated_by` | ObjectId | — | — | 🔗 ref `user` | ✅ | |
| `created_at` | Date | auto | — | timestamps | ✅ | |
| `updated_at` | Date | auto | — | timestamps | ✅ | |

### Sub-schema: `template`

| Field | Type | Required | Validation | Status |
|-------|------|----------|------------|--------|
| `_id` | ObjectId | auto | — | ✅ |
| `name` | String | ✅ | — | ✅ |
| `questions` | ObjectId[] | ✅ | 🔗 ref `question_bank` | ✅ |

### Sub-schema: `participants[]` (embedded) ⚠️

> **⚠️ Sẽ bỏ** — Chuyển sang collection riêng `exam_participant` để hỗ trợ nhiều lượt thi.

| Field | Type | Required | Validation | Status |
|-------|------|----------|------------|--------|
| `user_id` | ObjectId | ✅ | 🔗 ref `user` | ⚠️ |
| `start_time` | Date | ✅ | — | ⚠️ |
| `submit_time` | Date | ✅ | — | ⚠️ |
| `answers` | Array | ✅ | — | ⚠️ |
| `answers[].question_id` | ObjectId | ✅ | 🔗 ref `question_bank` | ⚠️ |
| `answers[].user_answer` | ObjectId | — | ID đáp án user chọn | ⚠️ |
| `answers[].question_answers` | ObjectId[] | ✅ | Snapshot tất cả đáp án | ⚠️ |

---

## 4. Collection: `exam_participant` ✅

> **✅ ĐÃ TẠO**  
> Tách từ `exam.participants[]`. Mỗi document = 1 lượt thi của 1 user trong 1 kỳ thi.

| Field | Type | Required | Default | Validation | Status | Ghi chú |
|-------|------|----------|---------|------------|--------|---------|
| `_id` | ObjectId | auto | — | — | ✅ | 🔑 PK |
| `exam_id` | ObjectId | ✅ | — | 🔗 ref `exam` | ✅ | |
| `user_id` | ObjectId | ✅ | — | 🔗 ref `user` | ✅ | |
| `attempt_number` | Number | ✅ | — | integer, 1–5 | ✅ | Lượt thi thứ mấy |
| `status` | String | ✅ | `"in_progress"` | enum `[registered, in_progress, submitted]` | ✅ | |
| `start_time` | Date | — | — | — | ✅ | Thời điểm bắt đầu làm bài |
| `submit_time` | Date | — | — | phải > `start_time` | ✅ | Thời điểm nộp bài |
| `score` | Number | — | — | 0 – tổng câu hỏi | ✅ | Số câu đúng (MC only) |
| `time_taken` | Number | — | — | đơn vị: phút (decimal) | ✅ | Thời gian làm bài thực tế |
| `shuffled_questions` | ObjectId[] | ✅ | — | 🔗 ref `question_bank` | ✅ | Thứ tự câu hỏi đã shuffle |
| `shuffled_answers` | Mixed | — | — | Map question_id → answer order | ✅ | Thứ tự đáp án đã shuffle |
| `answers` | Array | — | `[]` | — | ✅ | Bài làm của thí sinh |
| `answers[].question_id` | ObjectId | ✅ | — | 🔗 ref `question_bank` | ✅ | |
| `answers[].user_answer` | ObjectId | — | — | ID đáp án (MC) | ✅ | Cho câu trắc nghiệm |
| `answers[].text_answer` | String | — | — | — | ✅ | Cho câu tự luận |
| `answers[].is_correct` | Boolean | — | — | Tính từ `question_bank` | ✅ | `null` cho ESSAY |
| `created_at` | Date | auto | — | timestamps | ✅ | |
| `updated_at` | Date | auto | — | timestamps | ✅ | |

**Indexes:**
```javascript
{ exam_id: 1, user_id: 1 }                         // Compound index — tìm lượt thi của user
{ exam_id: 1, user_id: 1, attempt_number: 1 }      // Unique compound — đảm bảo không trùng lượt
{ exam_id: 1, status: 1 }                           // Thống kê theo kỳ thi
{ exam_id: 1, score: -1, time_taken: 1 }            // Xếp hạng: điểm cao nhất, thời gian thấp nhất
```

**Business rules:**
- Mỗi user tối đa **5 lượt thi** / kỳ thi (đọc `max_attempts` từ `exam_rules` trong WebsiteConfig)
- Khi `begin`: tạo document mới (`status: in_progress`), shuffle câu hỏi + đáp án
- Khi `submit`: cập nhật `answers`, tính `score` + `time_taken`, set `status: submitted`
- Thống kê lấy lượt thi có **điểm cao nhất** + **thời gian thấp nhất** tương ứng

---

## 5. Collection: `question_bank` ✅

> Ngân hàng câu hỏi (trắc nghiệm + tự luận).

| Field | Type | Required | Default | Validation | Status | Ghi chú |
|-------|------|----------|---------|------------|--------|---------|
| `_id` | ObjectId | auto | — | — | ✅ | 🔑 PK |
| `name` | String | ✅ | — | — | ✅ | Nội dung câu hỏi |
| `type` | String | ✅ | `"MULTIPLE_CHOICE"` | enum `[MULTIPLE_CHOICE, ESSAY]` | ✅ | **MỚI** |
| `level` | String | ✅ | — | enum `[EASY, NORMAL, HARD]` | ✅ | Độ khó |
| `priority` | Number | ✅ | — | — | ✅ | Thứ tự ưu tiên |
| `files` | ObjectId[] | — | `[]` | 🔗 ref `file` | ✅ | Hình ảnh / file đính kèm |
| `answers` | Array | ✅ (*) | — | 2–4 phần tử, đúng 1 `is_correct` | ✅ | (*) Required cho MC, optional cho ESSAY |
| `answers[]._id` | ObjectId | auto | — | — | ✅ | |
| `answers[].value` | String | ✅ | — | — | ✅ | Nội dung đáp án |
| `answers[].is_correct` | Boolean | ✅ | — | — | ✅ | Đáp án đúng |
| `is_deleted` | Boolean | — | `false` | — | ✅ | Soft delete |
| `created_by` | ObjectId | — | — | 🔗 ref `user` | ✅ | |
| `updated_by` | ObjectId | — | — | 🔗 ref `user` | ✅ | |
| `created_at` | Date | auto | — | timestamps | ✅ | |
| `updated_at` | Date | auto | — | timestamps | ✅ | |

**Validation rules (hiện tại):**
- `answers`: phải có 2–4 phần tử (`arrayLimit`)
- Đúng **1** đáp án có `is_correct: true`

**Thay đổi đã làm:**
- Thêm field `type` (✅)
- Câu `ESSAY`: `answers` có thể rỗng `[]`, bỏ validate `arrayLimit` (✅)
- Câu `MULTIPLE_CHOICE`: giữ nguyên validate hiện tại (✅)

**Business rules:**
- Xóa câu hỏi = soft delete (`is_deleted: true`)
- Cập nhật câu hỏi = **copy-on-write**: tạo bản mới, soft-delete bản cũ → đề thi cũ giữ nguyên reference

---

## 6. Collection: `file` ✅

> Quản lý file upload (ảnh, video, document).

| Field | Type | Required | Default | Validation | Status | Ghi chú |
|-------|------|----------|---------|------------|--------|---------|
| `_id` | ObjectId | auto | — | — | ✅ | 🔑 PK |
| `file_name` | String | ✅ | — | unique 📇 | ✅ | UUID-generated filename |
| `original_name` | String | ✅ | — | — | ✅ | Tên file gốc |
| `mime_type` | String | ✅ | — | — | ✅ | `image/jpeg`, `video/mp4`... |
| `file_type` | String | ✅ | — | `IMAGE` / `VIDEO` / `DOCUMENT` | ✅ | |
| `file_path` | String | ✅ | — | — | ✅ | Đường dẫn trên server |
| `size` | Number | ✅ | — | — | ✅ | Bytes |
| `created_by` | ObjectId | — | — | 🔗 ref `user` | ✅ | |
| `updated_by` | ObjectId | — | — | 🔗 ref `user` | ✅ | |
| `created_at` | Date | auto | — | timestamps | ✅ | |
| `updated_at` | Date | auto | — | timestamps | ✅ | |

**Behavior:**
- Upload ảnh → auto compress sang nhiều kích thước (desktop, tablet, mobile, preview, preload) bằng `sharp`
- Upload video → compress bằng `fluent-ffmpeg`
- `file_name` sinh bằng `uuid v4`
- `DELETE /file/{id}` xóa cả file vật lý + DB record

---

## 7. Collection: `website_config` ✅

> Cấu hình website. Có 1 document duy nhất (`is_default: true`).

| Field | Type | Required | Default | Validation | Status | Ghi chú |
|-------|------|----------|---------|------------|--------|---------|
| `_id` | ObjectId | auto | — | — | ✅ | 🔑 PK |
| `name` | String | — | — | — | ✅ | Tên website / cuộc thi |
| `phone` | String | — | — | — | ✅ | |
| `email` | String | — | — | — | ✅ | |
| `website` | String | — | — | — | ✅ | |
| `address` | String | — | — | — | ✅ | |
| `logo` | ObjectId | — | — | 🔗 ref `file` | ✅ | 1 file logo |
| `banner` | ObjectId | — | — | 🔗 ref `file` | ⚠️ | Sẽ thay bằng `banners[]` |
| `banners` | ObjectId[] | — | `[]` | 🔗 ref `file` | ✅ | **MỚI** — Nhiều banner slider |
| `guide_video` | ObjectId | — | — | 🔗 ref `file` | ✅ | **MỚI** — Video hướng dẫn |
| `theme` | String | — | — | — | ✅ | Theme color |
| `is_default` | Boolean | — | `false` | — | ✅ | Chỉ 1 document active |
| `profile_schema` | Array | — | — | — | ✅ | **MỚI** — Config-First (xem dưới) |
| `exam_rules` | Object | — | — | — | ✅ | **MỚI** — Config-First (xem dưới) |
| `unit_schema` | Object | — | — | — | ✅ | **MỚI** — Config-First (xem dưới) |
| `created_by` | ObjectId | — | — | 🔗 ref `user` | ✅ | |
| `updated_by` | ObjectId | — | — | 🔗 ref `user` | ✅ | |
| `created_at` | Date | auto | — | timestamps | ✅ | |
| `updated_at` | Date | auto | — | timestamps | ✅ | |

### ✅ Sub-schema: `profile_schema[]` (Config-First)

> Định nghĩa các fields bổ sung trong `user.profile`. Hệ thống validate dynamic + FE tự render form.

```json
[
  {
    "key": "identity_number",
    "label": "Số CCCD",
    "type": "text",
    "required": true,
    "unique": true
  },
  {
    "key": "date_of_birth",
    "label": "Ngày sinh",
    "type": "date",
    "required": true
  },
  {
    "key": "gender",
    "label": "Giới tính",
    "type": "select",
    "options": ["Nam", "Nữ", "Khác"],
    "required": true
  },
  {
    "key": "class_name",
    "label": "Lớp",
    "type": "text",
    "required": true
  },
  {
    "key": "school_name",
    "label": "Trường học",
    "type": "text",
    "required": true
  },
  {
    "key": "school_address",
    "label": "Địa chỉ trường",
    "type": "text",
    "required": false
  }
]
```

| Field | Type | Required | Mô tả |
|-------|------|----------|--------|
| `key` | String | ✅ | Key trong `user.profile` |
| `label` | String | ✅ | Label hiển thị trên UI |
| `type` | String | ✅ | `text` / `date` / `select` / `number` |
| `options` | String[] | — | Danh sách options (cho type `select`) |
| `required` | Boolean | — | Bắt buộc khi đăng ký/sửa profile |
| `unique` | Boolean | — | Kiểm tra trùng lặp trong DB |

### ✅ Sub-schema: `exam_rules` (Config-First)

> Quy tắc thi, áp dụng cho tất cả kỳ thi.

```json
{
  "max_attempts": 5,
  "time_minutes": 20,
  "question_config": [
    { "type": "MULTIPLE_CHOICE", "count": 20 },
    { "type": "ESSAY", "count": 1 }
  ],
  "essay_grading": "manual"
}
```

| Field | Type | Mô tả |
|-------|------|--------|
| `max_attempts` | Number | Số lượt thi tối đa / user / kỳ thi |
| `time_minutes` | Number | Thời gian làm bài (phút) |
| `question_config` | Array | Cấu hình số lượng câu hỏi theo loại |
| `question_config[].type` | String | `MULTIPLE_CHOICE` hoặc `ESSAY` |
| `question_config[].count` | Number | Số câu hỏi random |
| `essay_grading` | String | `manual` (chấm tay) hoặc `auto` (tương lai) |

### ✅ Sub-schema: `unit_schema` (Config-First)

> Cấu hình cách nhóm thống kê theo đơn vị.

```json
{
  "group_by_field": "profile.school_name",
  "group_label": "Trường học",
  "classification_field": "profile.class_name",
  "classification_rules": [
    { "label": "THCS", "pattern": "^[6-9]$" },
    { "label": "THPT", "pattern": "^(10|11|12)$" }
  ]
}
```

| Field | Type | Mô tả |
|-------|------|--------|
| `group_by_field` | String | Field trong user dùng để group by thống kê |
| `group_label` | String | Label hiển thị (tên đơn vị) |
| `classification_field` | String | Field dùng để phân loại (THCS/THPT) |
| `classification_rules` | Array | Regex patterns phân loại |
| `classification_rules[].label` | String | Nhãn phân loại |
| `classification_rules[].pattern` | String | Regex match trên field |

---

## 8. Collection: `content_page` ✅

> **✅ ĐÃ TẠO**  
> Quản lý nội dung trang CMS: thể lệ, tài liệu tham khảo, thông báo kết quả, liên hệ...

| Field | Type | Required | Default | Validation | Status | Ghi chú |
|-------|------|----------|---------|------------|--------|---------|
| `_id` | ObjectId | auto | — | — | ✅ | 🔑 PK |
| `title` | String | ✅ | — | min 1, max 255 | ✅ | Tiêu đề trang |
| `slug` | String | ✅ | — | unique 📇, URL-safe | ✅ | URL-friendly slug |
| `type` | String | ✅ | — | enum (xem dưới) | ✅ | Loại trang |
| `content` | String | ✅ | — | HTML | ✅ | Nội dung (rich text) |
| `sort_order` | Number | — | `0` | — | ✅ | Thứ tự hiển thị |
| `is_active` | Boolean | — | `true` | — | ✅ | Ẩn/hiện |
| `files` | ObjectId[] | — | `[]` | 🔗 ref `file` | ✅ | File đính kèm (PDF, doc...) |
| `created_by` | ObjectId | — | — | 🔗 ref `user` | ✅ | |
| `updated_by` | ObjectId | — | — | 🔗 ref `user` | ✅ | |
| `created_at` | Date | auto | — | timestamps | ✅ | |
| `updated_at` | Date | auto | — | timestamps | ✅ | |

**Enum `type`:**
- `exam_rules` — Thể lệ cuộc thi
- `reference_docs` — Tài liệu tham khảo
- `results` — Thông báo kết quả
- `contact` — Liên hệ
- `announcement` — Thông báo chung

**Indexes:**
```javascript
{ slug: 1 }              // Unique index cho URL lookup
{ type: 1, sort_order: 1 } // Lấy danh sách theo loại + sắp xếp
{ is_active: 1, type: 1 } // Public query: chỉ lấy trang active
```

---

## Tổng hợp Collections

| # | Collection | Documents dự kiến | Status | Ghi chú |
|---|-----------|-------------------|--------|---------|
| 1 | `user` | ~500–5000 | ✅ | Đã thêm `profile` (Mixed) |
| 2 | `user_auth` | ~1000–10000 | ✅ | 1 PASSWORD + N OTP mỗi user |
| 3 | `exam` | ~1–5 | ✅ → ⚠️ | Bỏ embedded `participants[]` |
| 4 | `exam_participant` | ~2500–25000 | ✅ | **MỚI** — 5 lượt/user × N users |
| 5 | `question_bank` | ~200–500 | ✅ | Đã thêm `type` |
| 6 | `file` | ~50–300 | ✅ | |
| 7 | `website_config` | 1 | ✅ | Đã mở rộng Config-First |
| 8 | `content_page` | ~5–20 | ✅ | **MỚI** |

---

## Migration Plan

### Bước 1: Schema changes (không phá dữ liệu cũ) ✅
1. `user` — Thêm `profile: { type: Schema.Types.Mixed }` (backward compatible)
2. `question_bank` — Thêm `type: { type: String, enum: [...], default: 'MULTIPLE_CHOICE' }` (có default)
3. `website_config` — Thêm `banners`, `guide_video`, `profile_schema`, `exam_rules`, `unit_schema`

### Bước 2: Tạo collections mới ✅
4. Tạo model `exam_participant` + indexes
5. Tạo model `content_page` + indexes

### Bước 3: Data migration
6. Migrate `exam.participants[]` → `exam_participant` documents (1 lượt / document)
7. Migrate `user.unit` → `user.profile` (copy data)
8. Seed `website_config` với `profile_schema`, `exam_rules`, `unit_schema` cho client hiện tại

### Bước 4: Cleanup
9. Đánh dấu `exam.participants` là deprecated (giữ data cũ, không ghi thêm)
10. Đánh dấu `user.unit` là deprecated
