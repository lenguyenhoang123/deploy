# EXAM_FLOW — Luồng thi trực tuyến (Bản cuối)

> **Ngày:** 30/03/2026  
> **Phiên bản:** 1.0 — Bản cuối (Config-First + ExamParticipant + Essay)  
> **Dự án:** Cuộc thi trực tuyến "Tìm hiểu về bảo tồn đa dạng sinh học"

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Kiến trúc dữ liệu liên quan](#2-kiến-trúc-dữ-liệu-liên-quan)
3. [Luồng tổng thể — End-to-End](#3-luồng-tổng-thể--end-to-end)
4. [Phase 1 — Đăng ký tài khoản](#4-phase-1--đăng-ký-tài-khoản)
5. [Phase 2 — Đăng nhập](#5-phase-2--đăng-nhập)
6. [Phase 3 — Xem danh sách kỳ thi & Đăng ký thi](#6-phase-3--xem-danh-sách-kỳ-thi--đăng-ký-thi)
7. [Phase 4 — Bắt đầu làm bài (Begin Exam)](#7-phase-4--bắt-đầu-làm-bài-begin-exam)
8. [Phase 5 — Làm bài thi (In-Progress)](#8-phase-5--làm-bài-thi-in-progress)
9. [Phase 6 — Nộp bài (Submit)](#9-phase-6--nộp-bài-submit)
10. [Phase 7 — Xem kết quả](#10-phase-7--xem-kết-quả)
11. [Phase 8 — Thi lại (Retry)](#11-phase-8--thi-lại-retry)
12. [Luồng Admin — Quản lý kỳ thi](#12-luồng-admin--quản-lý-kỳ-thi)
13. [Luồng Admin — Chấm điểm tự luận](#13-luồng-admin--chấm-điểm-tự-luận)
14. [Thống kê & Export Excel](#14-thống-kê--export-excel)
15. [Quy tắc nghiệp vụ tổng hợp](#15-quy-tắc-nghiệp-vụ-tổng-hợp)
16. [API Reference tóm tắt](#16-api-reference-tóm-tắt)
17. [Xử lý lỗi & Edge Cases](#17-xử-lý-lỗi--edge-cases)
18. [Sơ đồ trạng thái](#18-sơ-đồ-trạng-thái)

---

## 1. Tổng quan

### Mô tả hệ thống

Hệ thống thi trực tuyến cho phép thí sinh đăng ký tài khoản, tham gia các kỳ thi trắc nghiệm + tự luận với nhiều lượt thi, xem kết quả chi tiết. Quản trị viên tạo kỳ thi, quản lý ngân hàng câu hỏi, chấm điểm tự luận, và xuất thống kê.

### Quy tắc cốt lõi

| Quy tắc | Giá trị | Nguồn cấu hình |
|---------|---------|-----------------|
| Số câu trắc nghiệm / đề | 20 | `WebsiteConfig.exam_rules.question_config` |
| Số câu tự luận / đề | 1 | `WebsiteConfig.exam_rules.question_config` |
| Thời gian làm bài | 20 phút | `Exam.allowed_time` |
| Số lượt thi tối đa / user / kỳ thi | 5 | `WebsiteConfig.exam_rules.max_attempts` |
| Cách chấm tự luận | Thủ công (Admin) | `WebsiteConfig.exam_rules.essay_grading` |
| Thời hạn OTP | 3 phút | Hardcode |
| JWT hết hạn | Cuối ngày | `dayjs().endOf("day")` |

### Tech Stack

```
Frontend:  React + TypeScript + Vite + Tailwind CSS + shadcn/ui + React Query (Orval)
Backend:   Node.js + Express + TypeScript + Mongoose 8.x
Database:  MongoDB
Auth:      JWT + bcrypt + OTP qua email (nodemailer)
```

---

## 2. Kiến trúc dữ liệu liên quan

### Collections tham gia luồng thi

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     user     │     │    user_auth     │     │  question_bank   │
│              │     │                  │     │                  │
│ email 📇    │     │ auth_method      │     │ type: MC|ESSAY   │
│ phone 📇    │     │ auth_key (hash)  │     │ level: EASY|     │
│ profile{}    │     │ user 🔗→user    │     │   NORMAL|HARD    │
│ is_active    │     └──────────────────┘     │ answers[]        │
│ is_admin     │                              └────────┬─────────┘
└──────┬───────┘                                       │
       │                                               │
       │         ┌──────────────────┐                  │
       │         │      exam        │                  │
       │         │                  │                  │
       │         │ start_time       │                  │
       │         │ end_time         │                  │
       │         │ allowed_time     │                  │
       │         │ template.        │                  │
       │         │  questions 🔗───│──────────────────┘
       │         └────────┬─────────┘
       │                  │
       │    ┌─────────────┴──────────────┐
       └────│    exam_participant         │
            │                            │
            │ exam_id 🔗→exam            │
            │ user_id 🔗→user            │
            │ attempt_number (1–5)       │
            │ status: registered |       │
            │   in_progress | submitted  │
            │ shuffled_questions[]       │
            │ shuffled_answers{}         │
            │ answers[] {question_id,    │
            │   user_answer, text_answer,│
            │   is_correct}              │
            │ score, time_taken          │
            └────────────────────────────┘

┌──────────────────┐
│  website_config  │
│                  │
│ exam_rules {     │
│   max_attempts,  │
│   time_minutes,  │
│   question_config│
│ }                │
│ profile_schema[] │
│ unit_schema{}    │
└──────────────────┘
```

### Mô hình dữ liệu `exam_participant`

Mỗi document = **1 lượt thi** của 1 user trong 1 kỳ thi.

```json
{
  "_id": "ObjectId",
  "exam_id": "ObjectId → exam",
  "user_id": "ObjectId → user",
  "attempt_number": 3,
  "status": "submitted",
  "start_time": "2026-05-15T09:00:00Z",
  "submit_time": "2026-05-15T09:18:30Z",
  "score": 15,
  "time_taken": 18.5,
  "shuffled_questions": ["qId1", "qId2", "..."],
  "shuffled_answers": {
    "qId1": ["aId3", "aId1", "aId4", "aId2"],
    "qId2": ["aId2", "aId4", "aId1", "aId3"]
  },
  "answers": [
    { "question_id": "qId1", "user_answer": "aId3", "is_correct": true },
    { "question_id": "qId2", "user_answer": "aId1", "is_correct": false },
    { "question_id": "qId21", "text_answer": "Bảo tồn...", "is_correct": null }
  ]
}
```

---

## 3. Luồng tổng thể — End-to-End

```
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║                           LUỒNG THI TRỰC TUYẾN — TOÀN BỘ                            ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                      ║
║  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐        ║
║  │ ĐĂNG KÝ  │───▶│ XÁC MINH │───▶│ ĐĂNG     │───▶│  ĐĂNG KÝ │───▶│ BẮT ĐẦU  │       ║
║  │ TÀI KHOẢN│    │   OTP    │    │  NHẬP    │    │   THI    │    │ LÀM BÀI │        ║
║  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └────┬─────┘        ║
║                                                                       │              ║
║                                                                       ▼              ║
║                 ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐         ║
║                 │ THI LẠI  │◀───│ XEM KẾT  │◀───│ NỘP BÀI │◀───│ LÀM BÀI │         ║
║                 │(nếu còn) │    │   QUẢ    │    │ (SUBMIT) │    │  20 phút │         ║
║                 └────┬─────┘    └──────────┘    └──────────┘    └──────────┘         ║
║                      │                                                               ║
║              ┌───────┴───────┐                                                       ║
║              │ Còn lượt? (≤5)│                                                       ║
║              ├─── Có ────────▶ Quay lại BẮT ĐẦU LÀM BÀI                            ║
║              └─── Không ─────▶ Kết thúc (hiển thị lịch sử)                           ║
║                                                                                      ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 4. Phase 1 — Đăng ký tài khoản

### API: `POST /auth/register`

```
  User (Browser)                    Backend                     Email Server
   │                                   │                             │
   │  POST /auth/register              │                             │
   │  {                                │                             │
   │    first_name, last_name,         │                             │
   │    middle_name,                   │                             │
   │    email, phone, password,        │                             │
   │    profile: {                     │                             │
   │      identity_number,             │                             │
   │      date_of_birth,               │                             │
   │      gender,                      │                             │
   │      class_name,                  │                             │
   │      school_name,                 │                             │
   │      school_address               │                             │
   │    }                              │                             │
   │  }                                │                             │
   │──────────────────────────────────▶│                             │
   │                                   │                             │
   │                        ┌──────────┴──────────┐                  │
   │                        │ 1. Validate cơ bản: │                  │
   │                        │    email, phone,     │                 │
   │                        │    password          │                 │
   │                        │                      │                 │
   │                        │ 2. Đọc profile_schema│                 │
   │                        │    từ WebsiteConfig  │                 │
   │                        │    → validate profile│                 │
   │                        │    fields dynamic    │                 │
   │                        │                      │                 │
   │                        │ 3. Check unique:     │                 │
   │                        │    email, phone, CCCD│                 │
   │                        │                      │                 │
   │                        │ 4. Create User       │                 │
   │                        │    (is_active=false)  │                │
   │                        │                      │                 │
   │                        │ 5. Hash password →   │                 │
   │                        │    UserAuth[PASSWORD] │                │
   │                        │                      │                 │
   │                        │ 6. Sinh OTP 6 số →   │                 │
   │                        │    Hash → UserAuth   │                 │
   │                        │    [OTP]             │                 │
   │                        └──────────┬───────────┘                 │
   │                                   │                             │
   │                                   │  Gửi email OTP              │
   │                                   │────────────────────────────▶│
   │                                   │                             │
   │  200 OK                           │                             │
   │◀──────────────────────────────────│                             │
   │                                   │                             │
   │  ═══ XÁC MINH OTP ═══            │                             │
   │                                   │                             │
   │  POST /auth/otp/verify            │                             │
   │  {email, otp}                     │                             │
   │──────────────────────────────────▶│                             │
   │                                   │                             │
   │                        ┌──────────┴──────────┐                  │
   │                        │ • bcrypt compare OTP│                  │
   │                        │ • Check hạn 3 phút  │                  │
   │                        │ • Xóa OTP record    │                  │
   │                        │ • is_active = true   │                 │
   │                        │ • Ký JWT token       │                 │
   │                        └──────────┬──────────┘                  │
   │                                   │                             │
   │  {accessToken, expiresIn}         │                             │
   │◀──────────────────────────────────│                             │
   │                                   │                             │
   │  ✅ Tài khoản đã kích hoạt        │                             │
```

### Validation chi tiết

| Field | Quy tắc | Nguồn |
|-------|---------|-------|
| `email` | Required, format email, unique | Hardcode |
| `phone` | Required, SĐT Việt Nam (`vi-VN`), unique | Hardcode |
| `password` | Required, ≥ 8 ký tự, không khoảng trắng | Hardcode |
| `first_name` | Required, chỉ chữ cái Unicode | Hardcode |
| `last_name` | Required, chỉ chữ cái Unicode | Hardcode |
| `profile.*` | Validate theo `profile_schema` từ WebsiteConfig | Config-First |

### Xử lý đặc biệt — Re-register

Nếu email đã đăng ký nhưng `is_active = false` (chưa verify OTP):
1. Cập nhật thông tin user mới
2. Cập nhật / tạo lại password
3. Sinh OTP mới, gửi lại email
4. **Không tạo user mới** — reuse record cũ

---

## 5. Phase 2 — Đăng nhập

### API: `POST /auth/login`

```
  User                              Backend
   │                                   │
   │  POST /auth/login                 │
   │  {email, password}                │
   │──────────────────────────────────▶│
   │                                   │
   │                        ┌──────────┴──────────┐
   │                        │ 1. Find user by email│
   │                        │ 2. Check is_deleted   │
   │                        │    → Lỗi nếu true    │
   │                        │ 3. Check is_active    │
   │                        │    → Lỗi nếu false   │
   │                        │ 4. Find UserAuth      │
   │                        │    (method=PASSWORD)   │
   │                        │ 5. bcrypt.compare()    │
   │                        │ 6. JWT sign:           │
   │                        │    payload: {id,       │
   │                        │     isAdmin}           │
   │                        │    exp: endOf("day")   │
   │                        └──────────┬──────────┘
   │                                   │
   │  {accessToken, expiresIn}         │
   │◀──────────────────────────────────│
   │                                   │
   │  FE: lưu token → sessionStorage   │
   │  FE: GET /user/myInfo             │
   │  FE: chuyển sang trang chính      │
```

### Quên mật khẩu

```
POST /auth/forgot-password {email}  →  Gửi OTP qua email
POST /auth/otp/verify {email, otp}  →  Nhận accessToken
POST /auth/reset-password {password} (Bearer token)  →  Đổi mật khẩu
```

---

## 6. Phase 3 — Xem danh sách kỳ thi & Đăng ký thi

### Bước 3a: Xem danh sách kỳ thi

#### API: `GET /user/exam` 🔒

```
  User                              Backend                         DB
   │                                   │                              │
   │  GET /user/exam                   │                              │
   │  Authorization: Bearer <token>    │                              │
   │──────────────────────────────────▶│                              │
   │                                   │                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Decode JWT → userId │                   │
   │                        │                     │                   │
   │                        │ For each exam:      │                   │
   │                        │ • Query exam info   │──────────────────▶│
   │                        │ • Count participants│◀──────────────────│
   │                        │   WHERE user_id =   │                   │
   │                        │   userId            │                   │
   │                        │ • is_registered?    │                   │
   │                        │ • attempts_used?    │                   │
   │                        │ • attempts_remaining│                   │
   │                        │   = max_attempts    │                   │
   │                        │   - attempts_used   │                   │
   │                        └──────────┬──────────┘                   │
   │                                   │                              │
   │  {rows: [{                        │                              │
   │    _id, name, description,        │                              │
   │    start_time, end_time,          │                              │
   │    allowed_time,                  │                              │
   │    template_name, question_count, │                              │
   │    is_registered,                 │                              │
   │    is_submitted,                  │                              │
   │    attempts_used: 2,              │                              │
   │    attempts_remaining: 3          │                              │
   │  }]}                              │                              │
   │◀──────────────────────────────────│                              │
```

**FE hiển thị trạng thái kỳ thi:**

```
┌─────────────────────────────────────────────────────────────┐
│  Vòng thi tìm hiểu đa dạng sinh học                        │
│  📅 01/05/2026 – 31/05/2026  ⏱️ 20 phút  📝 21 câu         │
│                                                             │
│  Trạng thái: Đã thi 2/5 lượt                                │
│  Điểm cao nhất: 14/20    Thời gian tốt nhất: 17:48          │
│                                                             │
│  [ Thi lại (còn 3 lượt) ]    [ Xem kết quả ]                │
└─────────────────────────────────────────────────────────────┘
```

### Bước 3b: Đăng ký thi

#### API: `PUT /user/exam/{exam_id}/register` 🔒

```
  User                              Backend
   │                                   │
   │  PUT /user/exam/{exam_id}/register│
   │──────────────────────────────────▶│
   │                                   │
   │                        ┌──────────┴──────────┐
   │                        │ Check:              │
   │                        │ 1. Kỳ thi tồn tại?  │
   │                        │ 2. now < end_time?   │
   │                        │ 3. Đã đăng ký chưa?  │
   │                        │                     │
   │                        │ Action:             │
   │                        │ Tạo exam_participant │
   │                        │ {exam_id, user_id,   │
   │                        │  status: "registered"│
   │                        │  attempt_number: 0}  │
   │                        └──────────┬──────────┘
   │                                   │
   │  "Đăng ký thi thành công"        │
   │◀──────────────────────────────────│
```

---

## 7. Phase 4 — Bắt đầu làm bài (Begin Exam)

### API: `PUT /user/exam/{exam_id}/begin` 🔒

Đây là phase quan trọng nhất — tạo lượt thi mới, random đề, shuffle câu hỏi + đáp án.

```
  User                              Backend                         DB
   │                                   │                              │
   │  PUT /user/exam/{exam_id}/begin   │                              │
   │──────────────────────────────────▶│                              │
   │                                   │                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ VALIDATE                    │           │
   │                        │ 1. Kỳ thi tồn tại?          │          │
   │                        │ 2. now >= start_time?        │          │
   │                        │    (Kỳ thi đã bắt đầu?)    │           │
   │                        │ 3. now <= end_time?          │          │
   │                        │    (Kỳ thi chưa hết hạn?)   │          │
   │                        │ 4. User đã đăng ký?         │          │
   │                        │ 5. Đọc max_attempts từ      │          │
   │                        │    WebsiteConfig.exam_rules  │          │
   │                        │ 6. Count lượt thi đã dùng   │──────────▶│
   │                        │    WHERE exam_id & user_id   │◀──────────│
   │                        │ 7. used < max_attempts?      │          │
   │                        │ 8. Không có lượt in_progress?│          │
   │                        └──────────┬──────────────────┘           │
   │                                   │                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ RANDOM ĐỀ THI               │          │
   │                        │                             │           │
   │                        │ Đọc question_config từ       │          │
   │                        │ WebsiteConfig.exam_rules:    │          │
   │                        │ [{type:"MC", count:20},      │          │
   │                        │  {type:"ESSAY", count:1}]    │          │
   │                        │                             │           │
   │                        │ Query question_bank:         │──────────▶│
   │                        │ • 20 câu type=MC,            │◀──────────│
   │                        │   is_deleted=false           │           │
   │                        │ • 1 câu type=ESSAY,          │          │
   │                        │   is_deleted=false           │           │
   │                        │                             │           │
   │                        │ 💡 Cân bằng theo level:      │          │
   │                        │   EASY / NORMAL / HARD       │          │
   │                        └──────────┬──────────────────┘           │
   │                                   │                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ SHUFFLE (Fisher-Yates)       │          │
   │                        │                             │           │
   │                        │ 1. Shuffle thứ tự câu hỏi   │          │
   │                        │    → shuffled_questions[]    │           │
   │                        │                             │           │
   │                        │ 2. Với mỗi câu MC:          │           │
   │                        │    Shuffle thứ tự đáp án     │          │
   │                        │    → shuffled_answers{}      │          │
   │                        │    (Map: question_id →       │          │
   │                        │     [answer_id order])       │          │
   │                        │                             │           │
   │                        │ 3. Câu ESSAY: giữ nguyên     │          │
   │                        │    (không có đáp án)         │           │
   │                        └──────────┬──────────────────┘           │
   │                                   │                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ TẠO DOCUMENT                 │          │
   │                        │                             │           │
   │                        │ Insert exam_participant:     │──────────▶│
   │                        │ {                           │           │
   │                        │   exam_id,                  │           │
   │                        │   user_id,                  │           │
   │                        │   attempt_number:            │          │
   │                        │     previous + 1,           │           │
   │                        │   status: "in_progress",     │          │
   │                        │   start_time: now,           │          │
   │                        │   shuffled_questions,        │          │
   │                        │   shuffled_answers,          │          │
   │                        │   answers: []               │           │
   │                        │ }                           │           │
   │                        └──────────┬──────────────────┘           │
   │                                   │                              │
   │  {                                │                              │
   │    participant_id: "ObjectId",    │                              │
   │    attempt_number: 3,             │                              │
   │    attempts_remaining: 2          │                              │
   │  }                                │                              │
   │◀──────────────────────────────────│                              │
```

### Thuật toán Fisher-Yates Shuffle

```
Input:  [Q1, Q2, Q3, Q4, Q5, ..., Q20, Q21(essay)]
                     │
        ┌────────────┴────────────┐
        │  Fisher-Yates Shuffle    │
        │  for i = n-1 down to 1:  │
        │    j = random(0, i)      │
        │    swap(arr[i], arr[j])  │
        └────────────┬────────────┘
                     │
Output: [Q7, Q3, Q15, Q1, ..., Q21(essay)]

Mỗi câu MC, đáp án cũng được shuffle:
  Q7: [A, B, C, D] → [C, A, D, B]
  Q3: [A, B, C, D] → [B, D, A, C]
```

---

## 8. Phase 5 — Làm bài thi (In-Progress)

### API: `GET /user/exam/{exam_id}/details` 🔒

```
  User                              Backend                         DB
   │                                   │                              │
   │  GET /user/exam/{exam_id}/details │                              │
   │  ?attempt_number=3               │                              │
   │──────────────────────────────────▶│                              │
   │                                   │                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Query exam_participant│                  │
   │                        │ (lượt mới nhất hoặc  │                  │
   │                        │  theo attempt_number)│──────────────────▶│
   │                        │                     │◀──────────────────│
   │                        │ Populate questions  │                   │
   │                        │ từ question_bank    │                   │
   │                        │                     │                   │
   │                        │ ⚠️ KHÔNG trả        │                   │
   │                        │   is_correct         │                  │
   │                        │   (chống gian lận)   │                  │
   │                        └──────────┬──────────┘                   │
   │                                   │                              │
   │  {                                │                              │
   │    exam_name, allowed_time,       │                              │
   │    template_name,                 │                              │
   │    quantity: 21,                  │                              │
   │    attempt_number: 3,             │                              │
   │    questions: [                   │                              │
   │      {                            │                              │
   │        _id, name,                 │                              │
   │        type: "MULTIPLE_CHOICE",   │                              │
   │        answers: [                 │                              │
   │          {_id, value},            │   ← Đã shuffle, KHÔNG có    │
   │          {_id, value},            │     is_correct               │
   │          {_id, value},            │                              │
   │          {_id, value}             │                              │
   │        ],                         │                              │
   │        files: [{file_path}]       │                              │
   │      },                           │                              │
   │      {                            │                              │
   │        _id, name,                 │                              │
   │        type: "ESSAY",             │                              │
   │        answers: [],               │   ← Không có đáp án          │
   │        files: null                │                              │
   │      }                            │                              │
   │    ]                              │                              │
   │  }                                │                              │
   │◀──────────────────────────────────│                              │
```

### FE — Giao diện làm bài

```
┌─────────────────────────────────────────────────────────────────────┐
│  📝 Đề thi: Vòng thi tìm hiểu đa dạng sinh học    ⏱️ 18:42       │
│  Lượt thi: 3/5                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Câu 7/21                                                           │
│                                                                     │
│  Loài động vật nào sau đây được liệt kê trong Sách đỏ Việt Nam?    │
│                                                                     │
│  🖼️ [Hình ảnh đính kèm]                                            │
│                                                                     │
│  ○ A. Gà rừng                                                       │
│  ● B. Sao la           ← User đã chọn                              │
│  ○ C. Mèo nhà                                                       │
│  ○ D. Chó nhà                                                       │
│                                                                     │
│  ← Câu trước    [Overview]    Câu sau →                             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Overview Panel:                                                     │
│  [1✅] [2✅] [3✅] [4⬜] [5✅] [6⬜] [7✅] [8⬜] [9⬜] [10⬜]        │
│  [11⬜] [12⬜] [13⬜] [14⬜] [15⬜] [16⬜] [17⬜] [18⬜] [19⬜] [20⬜]│
│  [21📝 Tự luận]                                                     │
│                                                                     │
│                              [ 📤 NỘP BÀI ]                         │
└─────────────────────────────────────────────────────────────────────┘
```

### FE — Câu hỏi tự luận

```
┌─────────────────────────────────────────────────────────────────────┐
│  Câu 21/21  (Tự luận)                                               │
│                                                                     │
│  Hãy nêu ý nghĩa của việc bảo tồn đa dạng sinh học đối với cuộc   │
│  sống con người.                                                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                                                             │     │
│  │  Bảo tồn đa dạng sinh học có ý nghĩa rất quan trọng...     │     │
│  │  [textarea — user tự nhập]                                  │     │
│  │                                                             │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ← Câu trước    [Overview]                                          │
│                              [ 📤 NỘP BÀI ]                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Hành vi FE trong lúc thi

| Hành vi | Mô tả |
|---------|-------|
| **Countdown timer** | `react-timer-hook`, đếm ngược từ `allowed_time` (20 phút) |
| **Auto-submit** | Tự gọi API submit khi timer = 0 |
| **Auto-next** | Carousel tự chuyển sang câu kế khi chọn đáp án MC |
| **Cho sửa đáp án** | Overview panel cho phép quay lại câu bất kỳ |
| **Chống thoát** | `beforeunload` event cảnh báo khi user rời trang |
| **Chống gian lận** | API không trả `is_correct` — chỉ trả sau khi submit |

---

## 9. Phase 6 — Nộp bài (Submit)

### API: `PUT /user/exam/{exam_id}/submit` 🔒

```
  User                              Backend                         DB
   │                                   │                              │
   │  PUT /user/exam/{exam_id}/submit  │                              │
   │  {                                │                              │
   │    start_time: "ISO8601",         │                              │
   │    submit_time: "ISO8601",        │                              │
   │    attempt_number: 3,             │                              │
   │    answers: [                     │                              │
   │      {question_id, user_answer},  │  ← Câu MC                   │
   │      {question_id, user_answer},  │  ← Câu MC                   │
   │      ...                          │                              │
   │      {question_id, text_answer}   │  ← Câu tự luận              │
   │    ]                              │                              │
   │  }                                │                              │
   │──────────────────────────────────▶│                              │
   │                                   │                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ VALIDATE                    │           │
   │                        │                             │           │
   │                        │ 1. start_time >= exam.      │           │
   │                        │    start_time               │           │
   │                        │ 2. submit_time > start_time │           │
   │                        │ 3. submit_time <= exam.     │           │
   │                        │    end_time                  │          │
   │                        │ 4. (submit - start) <=       │          │
   │                        │    allowed_time (20 phút)    │          │
   │                        │ 5. exam_participant.status   │          │
   │                        │    == "in_progress"          │          │
   │                        │    (chưa nộp trước đó)       │          │
   │                        └──────────┬──────────────────┘           │
   │                                   │                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ CHẤM ĐIỂM (MC only)        │           │
   │                        │                             │           │
   │                        │ For each answer:            │           │
   │                        │                             │           │
   │                        │   if MC:                    │           │
   │                        │     question = question_bank│           │
   │                        │       .findById(question_id)│──────────▶│
   │                        │     correct = question      │◀──────────│
   │                        │       .answers              │           │
   │                        │       .find(is_correct==true)│          │
   │                        │     is_correct =             │          │
   │                        │       user_answer ==         │          │
   │                        │       correct._id            │          │
   │                        │     if is_correct: score++   │          │
   │                        │                             │           │
   │                        │   if ESSAY:                 │           │
   │                        │     is_correct = null        │          │
   │                        │     (chờ Admin chấm)         │          │
   │                        └──────────┬──────────────────┘           │
   │                                   │                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ UPDATE exam_participant     │           │
   │                        │                             │           │
   │                        │ {                           │           │
   │                        │   answers: [...scored],      │          │
   │                        │   score: 15,  ← MC score    │──────────▶│
   │                        │   time_taken: 18.5 (phút),  │          │
   │                        │   submit_time: Date,         │          │
   │                        │   status: "submitted"        │          │
   │                        │ }                           │           │
   │                        └──────────┬──────────────────┘           │
   │                                   │                              │
   │  "Nộp bài thi thành công"        │                              │
   │◀──────────────────────────────────│                              │
```

### Công thức tính điểm

```
                    ┌─────────────────────────────────────┐
                    │         TÍNH ĐIỂM                    │
                    │                                     │
                    │  score = Σ (MC answers đúng)        │
                    │                                     │
                    │  Ví dụ: 20 câu MC                   │
                    │    → 15 đúng, 4 sai, 1 bỏ trống    │
                    │    → score = 15                     │
                    │                                     │
                    │  time_taken = (submit_time -         │
                    │    start_time) / 60000   (phút)     │
                    │    → 18 phút 30 giây = 18.5         │
                    │                                     │
                    │  Câu tự luận:                        │
                    │    → is_correct = null (chờ chấm)    │
                    │    → essay_score = null               │
                    └─────────────────────────────────────┘
```

---

## 10. Phase 7 — Xem kết quả

### API: `GET /user/exam/{exam_id}/result` 🔒

```
  User                              Backend                         DB
   │                                   │                              │
   │  GET /user/exam/{exam_id}/result  │                              │
   │  ?attempt_number=3               │                              │
   │  &currentPage=1&pageSize=10        │  ← Phân trang câu hỏi        │
   │  &filters=type==MULTIPLE_CHOICE  │  ← Lọc theo loại/đúng sai     │
   │  &sortField=type&sortOrder=asc   │  ← Sắp xếp                   │
   │──────────────────────────────────▶│                              │
   │                                   │                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ 1. Query exam_participant   │           │
   │                        │    (lượt cụ thể hoặc        │          │
   │                        │     lượt mới nhất)          │──────────▶│
   │                        │                             │◀──────────│
   │                        │ 2. Populate questions       │           │
   │                        │    từ question_bank         │           │
   │                        │    → TRẢ is_correct (!)     │           │
   │                        │                             │           │
   │                        │ 3. Apply filters            │           │
   │                        │    (type, is_correct)       │           │
   │                        │                             │           │
   │                        │ 4. Apply sort               │           │
   │                        │    (sortField, sortOrder)   │           │
   │                        │                             │           │
   │                        │ 5. Pagination             │           │
   │                        │    (slice theo page)        │           │
   │                        └──────────┬──────────────────┘           │
   │                                   │                              │
   │  {                                │                              │
   │    exam_name, allowed_time,       │                              │
   │    correct_count: 15,             │                              │
   │    time_taken: 18.5,              │                              │
   │    attempt_number: 3,           │                              │
   │    // user_profile: {            │  ← Tạm thời comment
   │    //   full_name, email...      │                              │
   │    // },                           │                              │
   │                                   │                              │
   │    questions: [                    │  ← Đã phân trang              │
   │      {name, type: "MC",           │                              │
   │       answers: [{value,          │                              │
   │         is_correct}],            │   ← Giờ TRẢ is_correct       │
   │       user_answer, is_correct},  │                              │
   │      {name, type: "ESSAY",       │                              │
   │       text_answer: "...",        │                              │
   │       essay_score: null,         │   ← null = chưa chấm         │
   │       is_correct: null}          │                              │
   │    ],                             │                              │
   │    answers: [...],                │                              │
   │    pagination: {                  │  ← Thông tin phân trang       │
   │      count: 21,                   │                              │
   │      pageSize: 10,                │                              │
   │      currentPage: 1,              │                              │
   │      totalPages: 3               │                              │
   │    }                              │                              │
   │  }                                │                              │
   │◀──────────────────────────────────│                              │
```

### FE — Trang kết quả

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏆 KẾT QUẢ THI — Lượt 3/5                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  👤 Thông tin thí sinh                                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Họ tên:       Nguyễn Văn A          CCCD: 079200012345     │    │
│  │ Ngày sinh:    15/05/2010             Giới tính: Nam         │    │
│  │ Lớp:          10                     SĐT: 0901234567       │    │
│  │ Trường:       THPT Nguyễn Du                                │    │
│  │ Địa chỉ:      Đường Nguyễn Du, Quận 1, TP.HCM              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  📊 Kết quả lượt thi hiện tại                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Số câu đúng (MC):  15/20         Thời gian: 18 phút 30 giây│    │
│  │ Câu tự luận:       ⏳ Chờ chấm điểm                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  📋 Lịch sử các lượt thi                                            │
│  ┌───────┬──────────┬────────────┬──────────────────────┐          │
│  │ Lượt  │ Điểm MC  │ Thời gian  │ Ngày thi             │          │
│  ├───────┼──────────┼────────────┼──────────────────────┤          │
│  │  1    │  12/20   │  19:12     │  15/05/2026 08:19    │          │
│  │  2    │  14/20   │  17:48     │  15/05/2026 08:42    │          │
│  │  3 ★  │  15/20   │  18:30     │  15/05/2026 09:18    │ ← hiện tại│
│  └───────┴──────────┴────────────┴──────────────────────┘          │
│                                                                     │
│  📝 Chi tiết bài làm (color-coded)                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Câu 1: ✅ Đúng    Câu 2: ❌ Sai    Câu 3: ✅ Đúng           │   │
│  │ Câu 4: ⬜ Bỏ trống  Câu 5: ✅ Đúng    ...                    │   │
│  │ Câu 21 (Tự luận): ⏳ Chờ chấm                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│       [ Thi lại (còn 2 lượt) ]    [ Về trang chủ ]                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 11. Phase 8 — Thi lại (Retry)

### API: `GET /user/exam/{exam_id}/attempts` 🔒

```
  User                              Backend
   │                                   │
   │  GET /user/exam/{exam_id}/attempts│
   │──────────────────────────────────▶│
   │                                   │
   │  {                                │
   │    exam_id: "ObjectId",           │
   │    used: 3,                       │
   │    remaining: 2,                  │
   │    max: 5                         │
   │  }                                │
   │◀──────────────────────────────────│
```

### Luồng thi lại

```
  User                              Backend
   │                                   │
   │  ┌─────────────────────────────┐  │
   │  │ FE: Kiểm tra lượt          │  │
   │  │ remaining > 0?             │  │
   │  │ Có → Hiện nút [Thi lại]   │  │
   │  │ Không → Disable + thông báo│  │
   │  └─────────────────────────────┘  │
   │                                   │
   │  ← User bấm [Thi lại] →         │
   │                                   │
   │  PUT /user/exam/{exam_id}/begin   │  ← Tạo lượt thi MỚI
   │──────────────────────────────────▶│
   │                                   │
   │  {attempt_number: 4,             │  ← Đề thi MỚI (random lại)
   │   attempts_remaining: 1}         │
   │◀──────────────────────────────────│
   │                                   │
   │  ... (lặp lại Phase 5–7) ...     │
   │                                   │
   │  ┌─────────────────────────────┐  │
   │  │ Khi hết 5 lượt:             │  │
   │  │ "Bạn đã sử dụng hết 5 lượt  │  │
   │  │  thi cho phép"               │  │
   │  │ [Thi lại] → DISABLED        │  │
   │  │ [Xem lịch sử] → ENABLED     │  │
   │  └─────────────────────────────┘  │
```

### API: `GET /user/exam/{exam_id}/history` 🔒

```
  User                              Backend
   │                                   │
   │  GET /user/exam/{exam_id}/history │
   │──────────────────────────────────▶│
   │                                   │
   │  {                                │
   │    exam_name: "...",              │
   │    attempts: [                    │
   │      {attempt: 1, score: 12,      │
   │       time_taken: 19.2,           │
   │       start_time: "ISO", submit_time: "ISO",
   │       status: "submitted"},       │
   │      {attempt: 2, score: 14,      │
   │       time_taken: 17.8,           │
   │       status: "submitted"},       │
   │      {attempt: 3, score: 15,      │
   │       time_taken: 18.5,           │
   │       status: "submitted"},       │
   │      {attempt: 4, score: null,    │
   │       time_taken: null,           │
   │       status: "in_progress"}      │
   │    ]                              │
   │  }                                │
   │◀──────────────────────────────────│
```

---

## 12. Luồng Admin — Quản lý kỳ thi

### Tạo kỳ thi + Đề thi

```
  Admin                             Backend                         DB
   │                                   │                              │
   │  ═══ BƯỚC 1: TẠO KỲ THI ═══     │                              │
   │                                   │                              │
   │  POST /exam                       │                              │
   │  {name, description,             │                              │
   │   start_time, end_time,          │                              │
   │   allowed_time: 20}              │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Validate:           │                   │
   │                        │ • start > now       │                   │
   │                        │ • end > start       │                   │
   │                        │ • allowed_time > 0  │                   │
   │                        │ Create exam         │──────────────────▶│
   │                        └──────────┬──────────┘                   │
   │  {_id, name, ...}                │                              │
   │◀──────────────────────────────────│                              │
   │                                   │                              │
   │  ═══ BƯỚC 2: TẠO ĐỀ THI (random câu hỏi) ═══                  │
   │                                   │                              │
   │  PUT /exam/{id}/templates         │                              │
   │  {name: "Đề thi chính thức"}     │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Đọc exam_rules từ   │                   │
   │                        │ WebsiteConfig:      │                   │
   │                        │ question_config:    │                   │
   │                        │ [{MC:20}, {ESSAY:1}]│                   │
   │                        │                     │                   │
   │                        │ Random từ           │                   │
   │                        │ question_bank:      │──────────────────▶│
   │                        │ • 20 câu MC         │◀──────────────────│
   │                        │ • 1 câu ESSAY       │                   │
   │                        │ (is_deleted=false)  │                   │
   │                        │                     │                   │
   │                        │ Lưu template        │                   │
   │                        │ vào exam.template   │──────────────────▶│
   │                        └──────────┬──────────┘                   │
   │  "Tạo đề thi thành công"         │                              │
   │◀──────────────────────────────────│                              │
```

### Lifecycle kỳ thi

```
  Tạo exam        start_time              end_time
     │                 │                      │
     ▼                 ▼                      ▼
  ┌────────┐      ┌──────────┐          ┌──────────┐
  │  DRAFT │─────▶│  ACTIVE  │─────────▶│ EXPIRED  │
  └────────┘      └──────────┘          └──────────┘
  ✅ Sửa/xóa OK   ❌ Không sửa được     ❌ Không sửa
  ✅ Tạo template  ✅ User đăng ký + thi  ✅ Xem thống kê
                   ✅ Admin xem thống kê  ✅ Export Excel
```

---

## 13. Luồng Admin — Chấm điểm tự luận

```
  Admin                             Backend                         DB
   │                                   │                              │
   │  GET /statistics/exam/{id}/       │                              │
   │      participant                  │                              │
   │──────────────────────────────────▶│                              │
   │                                   │                              │
   │  Danh sách thí sinh +            │                              │
   │  câu tự luận chưa chấm           │                              │
   │◀──────────────────────────────────│                              │
   │                                   │                              │
   │  GET /statistics/exam/{id}/       │                              │
   │      participant/{pid}            │                              │
   │──────────────────────────────────▶│                              │
   │                                   │                              │
   │  Chi tiết bài làm +              │                              │
   │  text_answer câu tự luận         │                              │
   │◀──────────────────────────────────│                              │
   │                                   │                              │
   │  ┌─────────────────────────────┐  │                              │
   │  │ Admin đọc bài tự luận      │  │                              │
   │  │ và chấm điểm thủ công      │  │                              │
   │  └─────────────────────────────┘  │                              │
   │                                   │                              │
   │  PUT /statistics/exam/{id}/       │                              │
   │      participant/{pid}/grade      │                              │
   │  {essay_score: 8}                │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Update answer:      │                   │
   │                        │ essay_score = 8     │                   │
   │                        │ is_correct = true   │──────────────────▶│
   │                        │ (hoặc partial)      │                   │
   │                        └──────────┬──────────┘                   │
   │  "Chấm điểm thành công"          │                              │
   │◀──────────────────────────────────│                              │
```

---

## 14. Thống kê & Export Excel

### Shuffle đề thi (Admin)

#### API: `PUT /exam/{id}/templates/{template_id}/shuffle` 🔒🔑

```
  Admin                             Backend                         DB
   │                                   │                              │
   │  PUT /exam/{id}/templates/{tid}/shuffle                           │
   │──────────────────────────────────▶│                              │
   │                                   │                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ VALIDATE:                   │           │
   │                        │ • exam tồn tại              │──────────▶│
   │                        │ • template tồn tại          │◀──────────│
   │                        │ • now < exam.start_time     │           │
   │                        │   (chỉ shuffle khi chưa bắt │           │
   │                        │    đầu)                     │           │
   │                        └──────────┬──────────────────┘           │
   │                                   │                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ ĐẾM câu hỏi hiện tại:       │           │
   │                        │ • multiple_choice_count     │           │
   │                        │ • essay_count               │           │
   │                        └──────────┬──────────────────┘           │
   │                                   │                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ RANDOM câu hỏi mới từ       │           │
   │                        │ question_bank:               │──────────▶│
   │                        │ • Cùng số lượng MC          │◀──────────│
   │                        │ • Cùng số lượng ESSAY       │           │
   │                        │ • Shuffle theo level        │           │
   │                        └──────────┬──────────────────┘           │
   │                                   │                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ UPDATE exam.templates       │──────────▶│
   │                        │ • exam.markModified('templates')         │
   │                        │ • exam.save()               │           │
   │                        └──────────┬──────────────────┘           │
   │                                   │                              │
   │  {                                │                              │
   │    multiple_choice_count: 20,     │                              │
   │    essay_count: 1,                │                              │
   │    old_questions: ["id1","id2"], │  ← Câu hỏi cũ (tham khảo)     │
   │    new_questions: ["id3","id4"]    │  ← Câu hỏi mới               │
   │  }                                │                              │
   │◀──────────────────────────────────│                              │
```

> **Lưu ý:** Chỉ shuffle được khi kỳ thi chưa bắt đầu (`now < start_time`).

---

### Thống kê theo cá nhân

```
  Admin                             Backend                         DB
   │                                   │                              │
   │  GET /statistics/exam/{id}/       │                              │
   │      participant                  │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ 1. Query exam_participant   │           │
   │                        │    WHERE status="submitted" │──────────▶│
   │                        │                             │◀──────────│
   │                        │ 2. Mỗi user:               │           │
   │                        │    → Lượt ĐIỂM CAO NHẤT     │          │
   │                        │    → Nếu trùng điểm:        │          │
   │                        │      THỜI GIAN THẤP NHẤT    │          │
   │                        │                             │           │
   │                        │ 3. Join user + profile      │           │
   │                        │                             │           │
   │                        │ 4. Phân loại THCS/THPT      │          │
   │                        │    theo classification_rules │          │
   │                        │    trong unit_schema         │          │
   │                        └──────────┬──────────────────┘           │
   │  {rows: [{                        │                              │
   │    rank, full_name,               │                              │
   │    identity_number, school_name,  │                              │
   │    class_name, classification,    │                              │
   │    best_score, best_time_taken,   │                              │
   │    total_attempts}]}              │                              │
   │◀──────────────────────────────────│                              │
```

### Thống kê theo đơn vị (trường học)

```
  Admin                             Backend
   │                                   │
   │  GET /statistics/exam/{id}/unit   │
   │──────────────────────────────────▶│
   │                        ┌──────────┴──────────────────┐
   │                        │ Đọc unit_schema từ          │
   │                        │ WebsiteConfig:              │
   │                        │ group_by_field =             │
   │                        │   "profile.school_name"     │
   │                        │                             │
   │                        │ Aggregate:                  │
   │                        │ GROUP BY school_name        │
   │                        │ → participant_count          │
   │                        │ → avg_correct_count          │
   │                        │ → avg_time_taken             │
   │                        └──────────┬──────────────────┘
   │  {rows: [{unit_name,              │
   │    participant_count,             │
   │    avg_correct_count, ...}]}      │
   │◀──────────────────────────────────│
```

### Export Excel

```
  Admin                             Backend
   │                                   │
   │  GET /statistics/exam/{id}/       │
   │      participant/export           │
   │──────────────────────────────────▶│
   │                        ┌──────────┴──────────────────┐
   │                        │ Tạo workbook (exceljs):     │
   │                        │                             │
   │                        │ Sheet 1: "THCS"             │
   │                        │ Sheet 2: "THPT"             │
   │                        │                             │
   │                        │ Columns:                    │
   │                        │ ┌─────────────────────────┐ │
   │                        │ │ STT                     │ │
   │                        │ │ Họ và tên                │ │
   │                        │ │ Số CCCD                  │ │
   │                        │ │ Ngày sinh                │ │
   │                        │ │ Giới tính                │ │
   │                        │ │ Lớp                      │ │
   │                        │ │ Trường học               │ │
   │                        │ │ Địa chỉ trường           │ │
   │                        │ │ SĐT                      │ │
   │                        │ │ Số lượt thi               │ │
   │                        │ │ Điểm cao nhất             │ │
   │                        │ │ Thời gian (phút:giây)     │ │
   │                        │ │ Ngày thi                  │ │
   │                        │ └─────────────────────────┘ │
   │                        └──────────┬──────────────────┘
   │  ← Content-Type:                  │
   │    application/vnd.openxmlformats │
   │  ← File download (.xlsx)         │
   │◀──────────────────────────────────│
```

### Public Counter (góc website)

```
  Visitor (public)                  Backend
   │                                   │
   │  GET /statistics/total-participants│
   │  (Không cần auth)                 │
   │──────────────────────────────────▶│
   │                                   │
   │  {                                │
   │    total_participants: 15230,     │  ← Số người (unique users)
   │    total_attempts: 42500          │  ← Tổng lượt thi
   │  }                                │
   │◀──────────────────────────────────│
```

---

## 15. Quy tắc nghiệp vụ tổng hợp

### Đăng ký & Xác thực

| # | Quy tắc |
|---|---------|
| 1 | Email, SĐT, CCCD phải **duy nhất** trong hệ thống |
| 2 | Password hash bằng **bcryptjs** (genSalt + hash) |
| 3 | OTP gồm **6 chữ số**, hash bcrypt, hết hạn **3 phút** |
| 4 | User mới: `is_active=false` → `true` sau khi verify OTP |
| 5 | JWT payload: `{id, isAdmin}`, expires: `dayjs().endOf("day")` |
| 6 | Token lưu `sessionStorage` (FE) |
| 7 | Email đã đăng ký + chưa active → cho phép **re-register** (cập nhật, không tạo mới) |

### Kỳ thi

| # | Quy tắc |
|---|---------|
| 8 | Mỗi kỳ thi có `start_time`, `end_time`, `allowed_time` (phút) |
| 9 | User phải **đăng ký** trước khi thi |
| 10 | User chỉ thi được khi `start_time ≤ now ≤ end_time` |
| 11 | Mỗi user tối đa **5 lượt / kỳ thi** (từ `WebsiteConfig.exam_rules.max_attempts`) |
| 12 | Mỗi lượt thi tạo **document mới** trong `exam_participant` |
| 13 | Đề thi **random** từ `question_bank` theo `question_config` (20 MC + 1 ESSAY) |
| 14 | Câu hỏi + đáp án **shuffle** bằng Fisher-Yates per participant |
| 15 | Không được có 2 lượt `in_progress` cùng lúc cho 1 user + 1 exam |

### Chấm điểm

| # | Quy tắc |
|---|---------|
| 16 | MC: chấm tự động — `user_answer == correct_answer._id` |
| 17 | ESSAY: `is_correct = null`, chờ Admin chấm thủ công |
| 18 | `score` = tổng số câu MC đúng (ESSAY không tính vào score tự động) |
| 19 | `time_taken` = `(submit_time - start_time)` đổi sang phút (decimal) |
| 20 | Thời gian làm bài không được vượt `allowed_time` |

### Thống kê & Xếp hạng

| # | Quy tắc |
|---|---------|
| 21 | Xếp hạng: lấy lượt có **điểm cao nhất** |
| 22 | Nếu trùng điểm: lấy lượt có **thời gian thấp nhất** |
| 23 | Phân loại THCS/THPT theo `unit_schema.classification_rules` |
| 24 | Group by đơn vị đọc từ `unit_schema.group_by_field` (Config-First) |
| 25 | Export Excel: 2 sheet riêng THCS + THPT |

---

## 16. API Reference tóm tắt

### Public (Không cần auth)

| Method | Path | Mô tả |
|--------|------|-------|
| `POST` | `/auth/login` | Đăng nhập |
| `POST` | `/auth/register` | Đăng ký tài khoản |
| `POST` | `/auth/otp/verify` | Xác minh OTP |
| `POST` | `/auth/otp/resend` | Gửi lại OTP |
| `POST` | `/auth/forgot-password` | Quên mật khẩu |
| `GET` | `/website-config` | Lấy cấu hình website |
| `GET` | `/content-page/public` | Lấy trang nội dung (thể lệ, tài liệu...) |
| `GET` | `/statistics/total-participants` | Đếm tổng lượt tham gia |

### User (🔒 Bearer Token)

| Method | Path | Mô tả |
|--------|------|-------|
| `POST` | `/auth/reset-password` | Đổi mật khẩu |
| `GET` | `/user/myInfo` | Thông tin tài khoản |
| `PUT` | `/user/myInfo` | Cập nhật profile |
| `GET` | `/user/exam` | Danh sách kỳ thi |
| `PUT` | `/user/exam/{id}/register` | Đăng ký thi |
| `PUT` | `/user/exam/{id}/begin` | Bắt đầu lượt thi mới |
| `GET` | `/user/exam/{id}/details` | Lấy đề thi (đang thi) |
| `PUT` | `/user/exam/{id}/submit` | Nộp bài |
| `GET` | `/user/exam/{id}/result` | Xem kết quả |
| `GET` | `/user/exam/{id}/attempts` | Kiểm tra số lượt thi |
| `GET` | `/user/exam/{id}/history` | Lịch sử lượt thi |

### Admin ( Bearer Token + isAdmin)

| Method | Path | Mô tả |
|--------|------|-------|
| `GET/POST` | `/exam` | CRUD kỳ thi |
| `GET/PUT/DELETE` | `/exam/{id}` | Chi tiết / Sửa / Xóa kỳ thi |
| `PUT` | `/exam/{id}/templates` | Tạo đề thi (random) |
| `PUT` | `/exam/{id}/templates/{tid}/shuffle` | Xào câu hỏi trong đề thi |
| `GET/POST` | `/question-bank` | CRUD câu hỏi |
| `POST` | `/question-bank/{id}/copy` | Sửa câu hỏi (copy-on-write) |
| `PUT` | `/question-bank/{id}/delete` | Xóa mềm câu hỏi |
| `POST` | `/question-bank/import` | Import câu hỏi từ Excel |
| `GET` | `/user` | Danh sách người dùng |
| `GET/PUT` | `/user/{id}` | Chi tiết / Sửa user |
| `PUT` | `/user/{id}/delete` | Xóa mềm user |
| `GET` | `/statistics/exam/{id}/participant` | Thống kê cá nhân |
| `GET` | `/statistics/exam/{id}/participant/export` | Export Excel |
| `GET` | `/statistics/exam/{id}/unit` | Thống kê theo đơn vị |
| `POST/GET` | `/file`, `/file/upload` | Upload / Quản lý file |
| `PUT` | `/website-config` | Cập nhật cấu hình website |
| `GET/POST/PUT/DELETE` | `/content-page` | CRUD trang nội dung |

---

## 17. Xử lý lỗi & Edge Cases

### Lỗi đăng ký / đăng nhập

| Tình huống | HTTP | Thông báo |
|-----------|------|-----------|
| Email đã tồn tại (active) | 500 | "Email này đã được đăng ký trước đó" |
| SĐT đã tồn tại | 500 | "Số điện thoại đã được đăng ký trước đó" |
| CCCD đã tồn tại | 500 | "Số CCCD đã được đăng ký trước đó" |
| Tài khoản bị xóa | 500 | "Tài khoản đã bị xóa khỏi hệ thống" |
| Tài khoản chưa active | 400 | "Tài khoản chưa được kích hoạt" |
| Mật khẩu sai | 500 | "Mật khẩu không chính xác" |
| OTP sai | 500 | "Mã xác minh không chính xác" |
| OTP hết hạn | 500 | "Mã xác minh đã hết hạn" |

### Lỗi luồng thi

| Tình huống | HTTP | Thông báo |
|-----------|------|-----------|
| Kỳ thi chưa bắt đầu | 500 | "Kỳ thi chưa diễn ra" |
| Kỳ thi đã hết hạn | 500 | "Kỳ thi đã hết hạn" |
| Chưa đăng ký thi | 500 | "Bạn chưa đăng ký kỳ thi này" |
| Hết lượt thi | 500 | "Bạn đã sử dụng hết số lượt thi cho phép (5 lượt)" |
| Đang có lượt in_progress | 500 | "Bạn đang có lượt thi chưa hoàn thành" |
| Chưa bắt đầu thi | 500 | "Bạn chưa bắt đầu bài thi. Không thể nộp bài." |
| Đã nộp bài rồi | 500 | "Bạn đã hoàn thành bài thi. Không thể nộp bài." |
| Thời gian vượt quá | 500 | "Thời gian làm bài không thể lớn hơn thời gian cho phép." |
| Chưa nộp bài (xem result) | 500 | "Bạn chưa nộp bài thi" |

### Edge Cases

| Case | Xử lý |
|------|-------|
| User mất kết nối giữa lúc thi | Lượt thi giữ `in_progress`. User có thể tiếp tục (GET details). Timer client-side vẫn chạy. |
| User F5 / reload trang thi | FE query lại `GET /user/exam/{id}/details` để khôi phục trạng thái. Timer tính lại từ `start_time`. |
| Hết giờ (timer = 0) | FE auto-submit: gọi `PUT /submit` với các đáp án đã chọn. Câu chưa trả lời = `user_answer: ""`. |
| Admin xóa kỳ thi khi có người đang thi | Kỳ thi `ACTIVE` không cho xóa/sửa. Chỉ xóa khi `DRAFT`. |
| 2 tab cùng user cùng thi | `exam_participant` unique index `(exam_id, user_id, attempt_number)` ngăn tạo trùng. Tab sau nhận lại đề thi hiện tại. |
| Câu hỏi bị xóa sau khi tạo đề | Copy-on-write: đề thi giữ ref bản cũ. `is_deleted=true` chỉ ẩn khỏi pool random, không ảnh hưởng đề đã tạo. |

---

## 18. Sơ đồ trạng thái

### Trạng thái User

```
                    ┌──────────────┐
                    │  Chưa đăng ký │
                    └──────┬───────┘
                           │ POST /auth/register
                           ▼
                    ┌──────────────┐
                    │  Chưa active  │  (is_active=false)
                    │  (chờ OTP)    │
                    └──────┬───────┘
                           │ POST /auth/otp/verify
                           ▼
                    ┌──────────────┐
                    │   Active     │  (is_active=true)
                    │  (đăng nhập  │
                    │   được)      │
                    └──────┬───────┘
                           │ PUT /user/{id}/delete
                           ▼
                    ┌──────────────┐
                    │   Deleted    │  (is_deleted=true)
                    │  (soft del)  │
                    └──────────────┘
```

### Trạng thái Lượt thi (ExamParticipant)

```
                    ┌──────────────┐
                    │  REGISTERED  │  ← PUT /register
                    └──────┬───────┘
                           │ PUT /begin (lượt đầu tiên)
                           ▼
                    ┌──────────────┐
  PUT /begin ──────▶│ IN_PROGRESS  │  ← Đang làm bài
  (lượt mới)        └──────┬───────┘
       ▲                   │ PUT /submit hoặc auto-submit
       │                   ▼
       │            ┌──────────────┐
       └────────────│  SUBMITTED   │  ← Đã nộp bài
       (nếu còn     └──────────────┘
        lượt)
```

### Trạng thái Kỳ thi (Exam)

```
  now < start_time     start_time ≤ now ≤ end_time     now > end_time
        │                        │                           │
        ▼                        ▼                           ▼
  ┌──────────┐            ┌──────────┐              ┌──────────┐
  │  DRAFT   │───────────▶│  ACTIVE  │─────────────▶│ EXPIRED  │
  └──────────┘            └──────────┘              └──────────┘
  ✅ CRUD exam             ❌ Không sửa              ❌ Không sửa
  ✅ Tạo template          ✅ Đăng ký thi             ✅ Xem thống kê
  ❌ Chưa thi được         ✅ Bắt đầu thi             ✅ Export Excel
                           ✅ Nộp bài                 ❌ Không thi
```

---

> **Ghi chú cuối:** Tài liệu này mô tả luồng thi **bản cuối** sau khi áp dụng kiến trúc Config-First + tách ExamParticipant + hỗ trợ câu tự luận. Tất cả quy tắc có thể thay đổi qua `WebsiteConfig` mà không cần sửa code.
