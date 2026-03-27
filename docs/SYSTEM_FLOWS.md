# System Flows — SHTT Online Exam

> **Updated:** 27/03/2026  
> **Version:** 1.0 (bản cuối — sau khi áp dụng Config-First + ExamParticipant)  
> **Chú thích:** 🟢 Flow hiện tại đã hoạt động | 🟡 Flow cần sửa | 🔴 Flow mới chưa có

---

## Mục lục

1. [Flow 1 — Đăng ký tài khoản](#flow-1--đăng-ký-tài-khoản)
2. [Flow 2 — Đăng nhập](#flow-2--đăng-nhập)
3. [Flow 3 — Quên mật khẩu](#flow-3--quên-mật-khẩu)
4. [Flow 4 — Luồng thi chính (User Exam Flow)](#flow-4--luồng-thi-chính-user-exam-flow)
5. [Flow 5 — Admin quản lý kỳ thi](#flow-5--admin-quản-lý-kỳ-thi)
6. [Flow 6 — Admin quản lý ngân hàng câu hỏi](#flow-6--admin-quản-lý-ngân-hàng-câu-hỏi)
7. [Flow 7 — Thống kê & Export Excel](#flow-7--thống-kê--export-excel)
8. [Flow 8 — Quản lý nội dung CMS (Content Page)](#flow-8--quản-lý-nội-dung-cms-content-page)
9. [Flow 9 — Cấu hình Website (Config-First)](#flow-9--cấu-hình-website-config-first)
10. [Flow 10 — Upload & Quản lý File](#flow-10--upload--quản-lý-file)
11. [Tổng quan kiến trúc hệ thống](#tổng-quan-kiến-trúc-hệ-thống)

---

## Tổng quan kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│  React + TypeScript + Vite + Tailwind CSS + shadcn/ui               │
│  Orval (auto-gen API hooks từ Swagger) + React Query               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express)                     │
│                                                                     │
│  ┌──────────┐   ┌────────────┐   ┌────────────┐   ┌─────────────┐  │
│  │   CORS   │──▶│BodyParser  │──▶│    Auth     │──▶│  Controller │  │
│  │Middleware │   │Compression │   │ Middleware  │   │(auto-routes)│  │
│  └──────────┘   └────────────┘   │verify/admin │   └──────┬──────┘  │
│                                  └────────────┘          │         │
│                                                          ▼         │
│                           ┌──────────────────────────────────┐     │
│                           │        Provider (Business Logic) │     │
│                           │  ┌──────────────────────────────┐│     │
│                           │  │     BaseProvider (CRUD)       ││     │
│                           │  │  getAll / getById / create    ││     │
│                           │  │  update / delete / getOne     ││     │
│                           │  └──────────────────────────────┘│     │
│                           └───────────────┬──────────────────┘     │
│                                           │                        │
│                                           ▼                        │
│                           ┌──────────────────────────────────┐     │
│                           │     Mongoose ODM → MongoDB       │     │
│                           └──────────────────────────────────┘     │
│                                                                     │
│  Services: Mail (nodemailer) │ Excel (exceljs) │ File (multer+sharp)│
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        MongoDB Database                             │
│                                                                     │
│  ┌──────┐ ┌──────────┐ ┌──────┐ ┌────────────────┐ ┌────────────┐ │
│  │ user │ │user_auth │ │ exam │ │exam_participant│ │question_bank│ │
│  └──────┘ └──────────┘ └──────┘ │    (MỚI 🔴)    │ └────────────┘ │
│                                 └────────────────┘                 │
│  ┌──────┐ ┌──────────────┐ ┌──────────────┐                       │
│  │ file │ │website_config│ │ content_page │                        │
│  └──────┘ └──────────────┘ │   (MỚI 🔴)   │                       │
│                            └──────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Flow 1 — Đăng ký tài khoản

> **Trạng thái:** 🟡 Cần sửa — Thêm `profile` fields (CCCD, DOB, giới tính, lớp, trường...)

```
  ┌──────────┐                    ┌──────────┐                  ┌──────────┐
  │  User    │                    │ Backend  │                  │  Email   │
  │ (Browser)│                    │  Server  │                  │  Server  │
  └────┬─────┘                    └────┬─────┘                  └────┬─────┘
       │                               │                             │
       │  1. POST /auth/register       │                             │
       │  {email, password, phone,     │                             │
       │   first_name, last_name,      │                             │
       │   profile: {identity_number,  │                             │
       │     date_of_birth, gender,    │                             │
       │     class_name, school_name,  │                             │
       │     school_address}}          │                             │
       │──────────────────────────────▶│                             │
       │                               │                             │
       │                    ┌──────────┴──────────┐                  │
       │                    │ Validate:           │                  │
       │                    │ • email format+unique│                 │
       │                    │ • phone vi-VN+unique│                  │
       │                    │ • password min 8    │                  │
       │                    │ • profile.* theo    │                  │
       │                    │   profile_schema    │                  │
       │                    │   từ WebsiteConfig  │                  │
       │                    │ • CCCD unique       │                  │
       │                    └──────────┬──────────┘                  │
       │                               │                             │
       │                    ┌──────────┴──────────┐                  │
       │                    │ DB Operations:      │                  │
       │                    │ 1. Create User      │                  │
       │                    │    (is_active=false) │                  │
       │                    │ 2. Hash password →  │                  │
       │                    │    Create UserAuth  │                  │
       │                    │    (method=PASSWORD) │                 │
       │                    │ 3. Generate OTP 6   │                  │
       │                    │    chữ số → Hash → │                  │
       │                    │    Create UserAuth  │                  │
       │                    │    (method=OTP)     │                  │
       │                    └──────────┬──────────┘                  │
       │                               │                             │
       │                               │  4. Send OTP email          │
       │                               │────────────────────────────▶│
       │                               │                             │
       │  5. Response 200              │                             │
       │  {status: "success"}          │                             │
       │◀──────────────────────────────│                             │
       │                               │                             │
       │  6. User nhập OTP             │                             │
       │                               │                             │
       │  7. POST /auth/otp/verify     │                             │
       │  {email, otp}                 │                             │
       │──────────────────────────────▶│                             │
       │                               │                             │
       │                    ┌──────────┴──────────┐                  │
       │                    │ Verify:             │                  │
       │                    │ 1. Find UserAuth    │                  │
       │                    │    (user+OTP method) │                 │
       │                    │ 2. bcrypt compare   │                  │
       │                    │ 3. Check hết hạn    │                  │
       │                    │    (3 phút)         │                  │
       │                    │ 4. Delete OTP record│                  │
       │                    │ 5. Set user         │                  │
       │                    │    is_active = true  │                 │
       │                    │ 6. Sign JWT token   │                  │
       │                    └──────────┬──────────┘                  │
       │                               │                             │
       │  8. Response 200              │                             │
       │  {accessToken, expiresIn}     │                             │
       │◀──────────────────────────────│                             │
       │                               │                             │
       │  ✅ User đã đăng nhập         │                             │
```

**Xử lý lỗi:**
- Email / SĐT / CCCD đã tồn tại → `500` + thông báo cụ thể
- OTP sai → `500` "Mã xác minh không chính xác"
- OTP hết hạn (>3 phút) → `500` "Mã xác minh đã hết hạn"
- Gửi lại OTP → `POST /auth/otp/resend` (xóa OTP cũ, tạo mới)

---

## Flow 2 — Đăng nhập

> **Trạng thái:** 🟢 Hoạt động

```
  User                          Backend
   │                               │
   │  POST /auth/login             │
   │  {email, password}            │
   │──────────────────────────────▶│
   │                               │
   │                    ┌──────────┴──────────┐
   │                    │ 1. Find user by email│
   │                    │ 2. Check is_active   │
   │                    │ 3. Check is_deleted  │
   │                    │ 4. Find UserAuth     │
   │                    │    (method=PASSWORD)  │
   │                    │ 5. bcrypt compare    │
   │                    │ 6. Sign JWT          │
   │                    │    payload: {id,     │
   │                    │     isAdmin}         │
   │                    │    expires: cuối ngày │
   │                    └──────────┬──────────┘
   │                               │
   │  {accessToken, expiresIn}     │
   │◀──────────────────────────────│
```

**JWT Token:**
- Payload: `{ id: userId, isAdmin: boolean }`
- Secret: từ config `JWT.Secret`
- Expires: cuối ngày hiện tại (`dayjs().endOf("day")`)

---

## Flow 3 — Quên mật khẩu

> **Trạng thái:** 🟢 Hoạt động

```
  User                          Backend                    Email
   │                               │                         │
   │  1. POST /auth/forgot-password│                         │
   │  {email}                      │                         │
   │──────────────────────────────▶│                         │
   │                               │  2. Generate OTP        │
   │                               │  3. Send email ────────▶│
   │  4. "Kiểm tra email"         │                         │
   │◀──────────────────────────────│                         │
   │                               │                         │
   │  5. POST /auth/otp/verify     │                         │
   │  {email, otp}                 │                         │
   │──────────────────────────────▶│                         │
   │                               │                         │
   │  6. {accessToken}  ◀──────────│                         │
   │                               │                         │
   │  7. POST /auth/reset-password │                         │
   │  {password}                   │                         │
   │  Header: Bearer <token>       │                         │
   │──────────────────────────────▶│                         │
   │                    ┌──────────┴──────────┐              │
   │                    │ Check: password mới │              │
   │                    │ ≠ password cũ       │              │
   │                    │ Update UserAuth     │              │
   │                    │ (auto-hash bcrypt)  │              │
   │                    └──────────┬──────────┘              │
   │                               │                         │
   │  8. "Đổi mật khẩu thành công"│                         │
   │◀──────────────────────────────│                         │
```

---

## Flow 4 — Luồng thi chính (User Exam Flow) ⭐

> **Trạng thái:** 🟡 Cần sửa lớn — Tách ExamParticipant, nhiều lượt thi, câu tự luận

Đây là flow quan trọng nhất, bao gồm: xem danh sách → đăng ký → bắt đầu → làm bài → nộp → xem kết quả.

```
  User                              Backend                         DB
   │                                   │                              │
   │  ══════════ BƯỚC 1: XEM DANH SÁCH KỲ THI ══════════            │
   │                                   │                              │
   │  GET /user/exam                   │                              │
   │  Header: Bearer <token>           │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Decode JWT → userId │                   │
   │                        │ Query exam list     │                   │
   │                        │ + check registered  │──────────────────▶│
   │                        │ + count attempts    │◀──────────────────│
   │                        └──────────┬──────────┘                   │
   │  {rows: [{                        │                              │
   │    name, start_time, end_time,    │                              │
   │    is_registered, is_submitted,   │                              │
   │    attempts_used,                 │                              │
   │    attempts_remaining}]}          │                              │
   │◀──────────────────────────────────│                              │
   │                                   │                              │
   │  ══════════ BƯỚC 2: ĐĂNG KÝ THI ══════════                     │
   │                                   │                              │
   │  PUT /user/exam/{exam_id}/register│                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Check:              │                   │
   │                        │ • Kỳ thi tồn tại?   │                  │
   │                        │ • Còn trong deadline?│                  │
   │                        │ • Đã đăng ký chưa?  │                  │
   │                        │ Create participant   │                  │
   │                        │ record (registered)  │──────────────────▶
   │                        └──────────┬──────────┘                   │
   │  "Đăng ký thi thành công"        │                              │
   │◀──────────────────────────────────│                              │
   │                                   │                              │
   │  ══════════ BƯỚC 3: BẮT ĐẦU LÀM BÀI ══════════                │
   │                                   │                              │
   │  PUT /user/exam/{exam_id}/begin   │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Check:              │                   │
   │                        │ • now >= start_time? │                  │
   │                        │ • now <= end_time?   │                  │
   │                        │ • Đã đăng ký?       │                  │
   │                        │ • Count attempts     │                  │
   │                        │   < max_attempts (5)?│──────────────────▶
   │                        │                     │◀──────────────────│
   │                        │ Actions:            │                   │
   │                        │ 1. Random 20 MC +   │                   │
   │                        │    1 ESSAY từ       │                   │
   │                        │    question_bank    │                   │
   │                        │ 2. Shuffle câu hỏi  │                  │
   │                        │    (Fisher-Yates)   │                   │
   │                        │ 3. Shuffle đáp án   │                   │
   │                        │    mỗi câu MC       │                   │
   │                        │ 4. Tạo document     │                   │
   │                        │    exam_participant  │                  │
   │                        │    (status:          │                  │
   │                        │     in_progress)    │──────────────────▶│
   │                        └──────────┬──────────┘                   │
   │  {participant_id,                 │                              │
   │   attempt_number: 3,             │                              │
   │   attempts_remaining: 2}         │                              │
   │◀──────────────────────────────────│                              │
   │                                   │                              │
   │  ══════════ BƯỚC 4: LẤY ĐỀ THI ══════════                      │
   │                                   │                              │
   │  GET /user/exam/{exam_id}/details │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Query               │                   │
   │                        │ exam_participant    │──────────────────▶│
   │                        │ (lượt mới nhất)     │◀──────────────────│
   │                        │ Populate questions  │                   │
   │                        │ from question_bank  │                   │
   │                        │ ⚠️ Không trả        │                  │
   │                        │   is_correct        │                   │
   │                        └──────────┬──────────┘                   │
   │  {exam_name, allowed_time,       │                              │
   │   questions: [                    │                              │
   │     {name, type: "MC",           │                              │
   │      answers: [{value}]},        │                              │
   │     {name, type: "ESSAY",        │                              │
   │      answers: []}                │                              │
   │   ]}                             │                              │
   │◀──────────────────────────────────│                              │
   │                                   │                              │
   │  ══════════ BƯỚC 5: LÀM BÀI ══════════                         │
   │                                   │                              │
   │  ┌────────────────────────────┐   │                              │
   │  │ FE hiển thị:               │   │                              │
   │  │ • Countdown timer 20 phút  │   │                              │
   │  │ • Carousel câu hỏi        │   │                              │
   │  │ • Radio buttons (MC)       │   │                              │
   │  │ • Textarea (ESSAY)         │   │                              │
   │  │ • Overview panel           │   │                              │
   │  │ • Auto-next khi chọn MC   │   │                              │
   │  │ • Cho phép quay lại sửa   │   │                              │
   │  │ • beforeunload chống thoát │   │                              │
   │  └────────────────────────────┘   │                              │
   │                                   │                              │
   │  ══════════ BƯỚC 6: NỘP BÀI ══════════                         │
   │  (User bấm nộp hoặc hết giờ auto-submit)                       │
   │                                   │                              │
   │  PUT /user/exam/{exam_id}/submit  │                              │
   │  {start_time, submit_time,        │                              │
   │   attempt_number,                 │                              │
   │   answers: [                      │                              │
   │     {question_id, user_answer},   │   ← MC                      │
   │     {question_id, text_answer}    │   ← ESSAY                   │
   │   ]}                              │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Validate:           │                   │
   │                        │ • submit > start    │                   │
   │                        │ • duration ≤ 20min  │                   │
   │                        │ • status != submitted│                  │
   │                        │                     │                   │
   │                        │ Tính điểm MC:       │                   │
   │                        │ for each answer:    │                   │
   │                        │   compare user_answer│                  │
   │                        │   với correct answer │                  │
   │                        │   trong question_bank│                  │
   │                        │                     │                   │
   │                        │ Update              │                   │
   │                        │ exam_participant:   │                   │
   │                        │ • answers = [...]   │                   │
   │                        │ • score = X         │                   │
   │                        │ • time_taken = Y    │                   │
   │                        │ • status = submitted│──────────────────▶│
   │                        └──────────┬──────────┘                   │
   │  "Nộp bài thi thành công"        │                              │
   │◀──────────────────────────────────│                              │
   │                                   │                              │
   │  ══════════ BƯỚC 7: XEM KẾT QUẢ ══════════                     │
   │                                   │                              │
   │  GET /user/exam/{exam_id}/result  │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Query               │                   │
   │                        │ exam_participant    │──────────────────▶│
   │                        │ + populate questions│◀──────────────────│
   │                        │ + populate user     │                   │
   │                        │ + get all attempts  │                   │
   │                        │ Trả is_correct      │                   │
   │                        │ cho từng câu MC     │                   │
   │                        │ Essay: is_correct   │                   │
   │                        │ = null (chờ chấm)   │                   │
   │                        └──────────┬──────────┘                   │
   │  {correct_count, time_taken,      │                              │
   │   user_profile: {...},            │                              │
   │   questions: [{..., is_correct}], │                              │
   │   attempt_history: [...]}         │                              │
   │◀──────────────────────────────────│                              │
```

### Flow 4b — Thi lại (Retry) 🔴

```
  User                              Backend
   │                                   │
   │  GET /user/exam/{id}/attempts     │
   │──────────────────────────────────▶│
   │  {used: 3, remaining: 2, max: 5} │
   │◀──────────────────────────────────│
   │                                   │
   │  ┌────────────────────────────┐   │
   │  │ FE hiển thị:               │   │
   │  │ "Bạn đã thi 3/5 lượt"     │   │
   │  │ [Thi lại] ← Button        │   │
   │  └────────────────────────────┘   │
   │                                   │
   │  PUT /user/exam/{id}/begin        │  ← Tạo lượt thi mới
   │──────────────────────────────────▶│
   │  {attempt_number: 4,             │
   │   attempts_remaining: 1}         │
   │◀──────────────────────────────────│
   │                                   │
   │  ... (lặp lại bước 4–7 ở trên)   │
   │                                   │
   │  ┌─────────────────────────────┐  │
   │  │ Khi hết 5 lượt:             │  │
   │  │ Button "Thi lại" → disabled │  │
   │  │ "Bạn đã sử dụng hết 5 lượt"│  │
   │  └─────────────────────────────┘  │
```

### Flow 4c — Xem lịch sử lượt thi 🔴

```
  User                              Backend
   │                                   │
   │  GET /user/exam/{id}/history      │
   │──────────────────────────────────▶│
   │                                   │
   │  {attempts: [                     │
   │    {attempt: 1, score: 12,        │
   │     time: 19.2, status: submitted}│
   │    {attempt: 2, score: 14,        │
   │     time: 17.8, status: submitted}│
   │    {attempt: 3, score: null,      │
   │     time: null, status: in_progress}│
   │  ]}                               │
   │◀──────────────────────────────────│
```

---

## Flow 5 — Admin quản lý kỳ thi

> **Trạng thái:** 🟡 Template cần sửa (Config-driven question count)

```
  Admin                             Backend                         DB
   │                                   │                              │
   │  ══════════ TẠO KỲ THI ══════════                              │
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
   │  ══════════ TẠO ĐỀ THI (Random câu hỏi) ══════════             │
   │                                   │                              │
   │  PUT /exam/{id}/templates         │                              │
   │  {name: "Đề thi chính thức"}     │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Đọc exam_rules từ   │                   │
   │                        │ WebsiteConfig:      │                   │
   │                        │ question_config: [  │                   │
   │                        │  {MC: 20, ESSAY: 1} │                   │
   │                        │ ]                   │                   │
   │                        │                     │                   │
   │                        │ Random từ           │                   │
   │                        │ question_bank:      │──────────────────▶│
   │                        │ • 20 câu type=MC    │◀──────────────────│
   │                        │   (is_deleted=false) │                  │
   │                        │ • 1 câu type=ESSAY  │                   │
   │                        │                     │                   │
   │                        │ Lưu template vào    │                   │
   │                        │ exam.template       │──────────────────▶│
   │                        └──────────┬──────────┘                   │
   │  "Tạo đề thi thành công"         │                              │
   │◀──────────────────────────────────│                              │
   │                                   │                              │
   │  ══════════ CẬP NHẬT / XÓA ══════════                          │
   │                                   │                              │
   │  PUT /exam/{id}                   │  ← Chỉ khi chưa start       │
   │  DELETE /exam/{id}                │  ← Hard delete               │
```

### Lifecycle kỳ thi:

```
  Tạo exam     start_time         end_time
     │              │                 │
     ▼              ▼                 ▼
  ┌──────┐     ┌──────────┐     ┌─────────┐
  │ DRAFT │────▶│  ACTIVE  │────▶│ EXPIRED │
  └──────┘     └──────────┘     └─────────┘
  Sửa/xóa OK   Không sửa được   Không sửa được
  Tạo template  User thi được    Chỉ xem thống kê
```

---

## Flow 6 — Admin quản lý ngân hàng câu hỏi

> **Trạng thái:** 🟡 Cần thêm `type` (MC/ESSAY) + Import Excel

```
  Admin                             Backend                         DB
   │                                   │                              │
   │  ══════════ TẠO CÂU HỎI TRẮC NGHIỆM ══════════                │
   │                                   │                              │
   │  POST /question-bank              │                              │
   │  {name: "...",                    │                              │
   │   type: "MULTIPLE_CHOICE",        │                              │
   │   level: "EASY",                  │                              │
   │   priority: 1,                    │                              │
   │   answers: [                      │                              │
   │     {value: "A", is_correct: true},│                             │
   │     {value: "B", is_correct: false},│                            │
   │     {value: "C", is_correct: false},│                            │
   │     {value: "D", is_correct: false} │                            │
   │   ]}                              │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Validate:           │                   │
   │                        │ • 2-4 đáp án        │                   │
   │                        │ • Đúng 1 is_correct │                   │
   │                        │ Create              │──────────────────▶│
   │                        └──────────┬──────────┘                   │
   │                                   │                              │
   │  ══════════ TẠO CÂU HỎI TỰ LUẬN 🔴 ══════════                 │
   │                                   │                              │
   │  POST /question-bank              │                              │
   │  {name: "...",                    │                              │
   │   type: "ESSAY",                  │                              │
   │   level: "HARD",                  │                              │
   │   priority: 1}                    │  ← Không cần answers         │
   │──────────────────────────────────▶│                              │
   │                                   │                              │
   │  ══════════ SỬA CÂU HỎI (Copy-on-Write) ══════════             │
   │                                   │                              │
   │  POST /question-bank/{id}/copy    │                              │
   │  {name: "...", answers: [...]}    │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ 1. Tạo câu hỏi MỚI │                   │
   │                        │    (new _id)        │──────────────────▶│
   │                        │ 2. Soft-delete      │                   │
   │                        │    câu hỏi CŨ       │                  │
   │                        │    (is_deleted=true) │──────────────────▶│
   │                        │                     │                   │
   │                        │ ⚠️ Đề thi cũ giữ    │                  │
   │                        │   reference bản cũ  │                   │
   │                        │   Đề thi mới dùng   │                   │
   │                        │   bản mới           │                   │
   │                        └──────────┬──────────┘                   │
   │                                   │                              │
   │  ══════════ IMPORT TỪ EXCEL 🔴 ══════════                      │
   │                                   │                              │
   │  POST /question-bank/import       │                              │
   │  (multipart/form-data: file.xlsx) │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Parse Excel (exceljs)│                  │
   │                        │ Row by row:         │                   │
   │                        │ • Col 1: Câu hỏi   │                   │
   │                        │ • Col 2-5: Đáp án   │                  │
   │                        │ • Col 6: Đáp án đúng│                  │
   │                        │ • Col 7: Loại       │                   │
   │                        │ • Col 8: Độ khó     │                   │
   │                        │ Validate + Bulk     │                   │
   │                        │ create              │──────────────────▶│
   │                        └──────────┬──────────┘                   │
   │  {total: 200,                     │                              │
   │   imported: 198,                  │                              │
   │   failed: 2,                      │                              │
   │   errors: [...]}                  │                              │
   │◀──────────────────────────────────│                              │
```

---

## Flow 7 — Thống kê & Export Excel

> **Trạng thái:** 🟡 Cần sửa — Group by trường học, THCS/THPT, nhiều lượt thi

### 7a. Thống kê theo cá nhân (Participant Statistics)

```
  Admin                             Backend                         DB
   │                                   │                              │
   │  GET /statistics/exam/{id}/       │                              │
   │      participant                  │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────────────┐           │
   │                        │ 1. Query exam_participant   │           │
   │                        │    WHERE exam_id = {id}     │           │
   │                        │    AND status = "submitted" │──────────▶│
   │                        │                             │◀──────────│
   │                        │ 2. Với mỗi user_id:        │           │
   │                        │    • Lấy lượt thi có        │           │
   │                        │      điểm CAO NHẤT          │           │
   │                        │    • Nếu trùng điểm →       │           │
   │                        │      lấy thời gian          │           │
   │                        │      THẤP NHẤT              │           │
   │                        │                             │           │
   │                        │ 3. Join user để lấy         │           │
   │                        │    profile (CCCD, DOB,      │           │
   │                        │    gender, lớp, trường)     │           │
   │                        │                             │           │
   │                        │ 4. Phân loại THCS/THPT      │           │
   │                        │    từ unit_schema.           │           │
   │                        │    classification_rules     │           │
   │                        │                             │           │
   │                        │ 5. Sort + Paginate          │           │
   │                        └──────────┬──────────────────┘           │
   │  {rows: [{name, identity_number,  │                              │
   │    school_name, class_name,       │                              │
   │    classification: "THPT",        │                              │
   │    best_score, best_time_taken,   │                              │
   │    total_attempts, rank}]}        │                              │
   │◀──────────────────────────────────│                              │
```

### 7b. Thống kê theo đơn vị (Unit Statistics)

```
  Admin                             Backend
   │                                   │
   │  GET /statistics/exam/{id}/unit   │
   │──────────────────────────────────▶│
   │                        ┌──────────┴──────────────────┐
   │                        │ 1. Đọc unit_schema từ       │
   │                        │    WebsiteConfig:           │
   │                        │    group_by_field =          │
   │                        │    "profile.school_name"    │
   │                        │                             │
   │                        │ 2. Aggregate participants    │
   │                        │    GROUP BY school_name     │
   │                        │                             │
   │                        │ 3. Tính per group:          │
   │                        │    • participant_count       │
   │                        │    • avg_correct_count       │
   │                        │    • avg_time_taken          │
   │                        │    • total_correct_count     │
   │                        │                             │
   │                        │ 4. Sort + Paginate          │
   │                        └──────────┬──────────────────┘
   │  {rows: [{unit_name,              │
   │    participant_count,             │
   │    avg_correct_count, ...}]}      │
   │◀──────────────────────────────────│
```

### 7c. Export Excel

```
  Admin                             Backend
   │                                   │
   │  GET /statistics/exam/{id}/       │
   │      participant/export           │
   │──────────────────────────────────▶│
   │                        ┌──────────┴──────────────────┐
   │                        │ 1. Aggregate giống 7a       │
   │                        │                             │
   │                        │ 2. Phân loại THCS/THPT     │
   │                        │    (unit_schema.            │
   │                        │     classification_rules)   │
   │                        │                             │
   │                        │ 3. Tạo workbook (exceljs):  │
   │                        │    Sheet 1: "THCS"          │
   │                        │    Sheet 2: "THPT"          │
   │                        │                             │
   │                        │ Columns mỗi sheet:          │
   │                        │ ┌───────────────────────┐   │
   │                        │ │ STT                   │   │
   │                        │ │ Họ và tên              │   │
   │                        │ │ Số CCCD                │   │
   │                        │ │ Ngày sinh              │   │
   │                        │ │ Giới tính              │   │
   │                        │ │ Lớp                    │   │
   │                        │ │ Trường học             │   │
   │                        │ │ Địa chỉ trường         │   │
   │                        │ │ SĐT                    │   │
   │                        │ │ Số lượt thi             │   │
   │                        │ │ Điểm cao nhất           │   │
   │                        │ │ Thời gian (phút:giây)   │   │
   │                        │ │ Ngày thi                │   │
   │                        │ └───────────────────────┘   │
   │                        │                             │
   │                        │ 4. Stream Excel binary      │
   │                        └──────────┬──────────────────┘
   │  ← Content-Type: xlsx             │
   │  ← File download                 │
   │◀──────────────────────────────────│
```

### 7d. Public Counter 🔴

```
  User (public)                     Backend
   │                                   │
   │  GET /statistics/total-participants│
   │  (Không cần auth)                 │
   │──────────────────────────────────▶│
   │                        ┌──────────┴──────────┐
   │                        │ Count exam_participant│
   │                        │ WHERE status =       │
   │                        │ "submitted"          │
   │                        └──────────┬──────────┘
   │  {total_participants: 15230,      │
   │   total_attempts: 42500}          │
   │◀──────────────────────────────────│
   │                                   │
   │  ┌────────────────────────────┐   │
   │  │ FE: Animated counter      │   │
   │  │ góc phải website           │   │
   │  │ "🏆 42.500 lượt tham gia" │   │
   │  └────────────────────────────┘   │
```

---

## Flow 8 — Quản lý nội dung CMS (Content Page) 🔴

> **Trạng thái:** 🔴 Chưa có — Cần tạo mới toàn bộ

```
  Admin                             Backend                         DB
   │                                   │                              │
   │  ══════════ TẠO TRANG NỘI DUNG ══════════                      │
   │                                   │                              │
   │  POST /content-page               │                              │
   │  {title: "Thể lệ cuộc thi",      │                              │
   │   slug: "the-le-cuoc-thi",        │                              │
   │   type: "exam_rules",            │                              │
   │   content: "<h1>...</h1>",        │                              │
   │   sort_order: 1,                  │                              │
   │   is_active: true,                │                              │
   │   files: ["ObjectId"]}            │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Validate slug unique │                  │
   │                        │ Validate file IDs    │                  │
   │                        │ Create content_page  │──────────────────▶│
   │                        └──────────┬──────────┘                   │
   │  {_id, title, slug}              │                              │
   │◀──────────────────────────────────│                              │
   │                                   │                              │
   │  ══════════ CRUD ══════════                                     │
   │                                   │                              │
   │  GET    /content-page             │  ← Admin list                │
   │  GET    /content-page/{id}        │  ← Admin detail              │
   │  PUT    /content-page/{id}        │  ← Admin update              │
   │  DELETE /content-page/{id}        │  ← Admin delete              │
   │                                   │                              │

  User (public)                     Backend
   │                                   │
   │  GET /content-page/public         │
   │  ?type=exam_rules                │
   │──────────────────────────────────▶│
   │                        ┌──────────┴──────────┐
   │                        │ Query: is_active=true│
   │                        │ Filter: type         │
   │                        │ Sort: sort_order     │
   │                        │ Populate: files      │
   │                        └──────────┬──────────┘
   │  [{title, content, files}]        │
   │◀──────────────────────────────────│
```

### Loại trang nội dung:

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   exam_rules     │   │ reference_docs   │   │    results       │
│   Thể lệ        │   │ Tài liệu tham   │   │ Thông báo kết    │
│   cuộc thi       │   │ khảo             │   │ quả              │
└──────────────────┘   └──────────────────┘   └──────────────────┘

┌──────────────────┐   ┌──────────────────┐
│    contact       │   │  announcement    │
│   Liên hệ        │   │ Thông báo chung  │
└──────────────────┘   └──────────────────┘
```

---

## Flow 9 — Cấu hình Website (Config-First) 🟡

> **Trạng thái:** 🟡 Cần mở rộng — Thêm banners[], guide_video, profile_schema, exam_rules, unit_schema

```
  Admin                             Backend                         DB
   │                                   │                              │
   │  GET /website-config              │  ← Public (không cần auth)   │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Find ONE document   │                   │
   │                        │ (is_default=true)   │──────────────────▶│
   │                        │ Populate: logo,     │◀──────────────────│
   │                        │ banners[], guide_   │                   │
   │                        │ video (ref file)    │                   │
   │                        └──────────┬──────────┘                   │
   │  {name, phone, email, website,    │                              │
   │   logo: {file_path, ...},         │                              │
   │   banners: [{...}, {...}],        │                              │
   │   guide_video: {...},             │                              │
   │   theme,                          │                              │
   │   profile_schema: [...],          │                              │
   │   exam_rules: {...},              │                              │
   │   unit_schema: {...}}             │                              │
   │◀──────────────────────────────────│                              │
   │                                   │                              │
   │  PUT /website-config              │  ← Admin only                │
   │  {banners: ["id1", "id2"],        │                              │
   │   guide_video: "id3",            │                              │
   │   profile_schema: [...],         │                              │
   │   exam_rules: {max_attempts: 5}, │                              │
   │   ...}                            │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Validate file IDs   │                   │
   │                        │ Update document     │──────────────────▶│
   │                        └──────────┬──────────┘                   │
   │  "Cập nhật thành công"            │                              │
   │◀──────────────────────────────────│                              │
```

### Config-First: Luồng đọc config khi validate

```
  Bất kỳ API nào cần validate profile:
  (register, update profile, ...)

  ┌──────────────────┐          ┌──────────────────────────┐
  │   Request body   │─────────▶│   Validator Service       │
  │ {profile: {...}} │          │                           │
  └──────────────────┘          │ 1. Đọc WebsiteConfig     │
                                │    .profile_schema       │
                                │                           │
                                │ 2. For each schema field: │
                                │    • required? → check    │
                                │    • type? → validate     │
                                │    • unique? → query DB   │
                                │    • options? → enum check│
                                │                           │
                                │ 3. Trả violations[] nếu   │
                                │    có lỗi                 │
                                └──────────────────────────┘
```

---

## Flow 10 — Upload & Quản lý File

> **Trạng thái:** 🟢 Hoạt động

```
  Admin                             Backend                         Disk
   │                                   │                              │
   │  POST /file/upload                │                              │
   │  (multipart/form-data)            │                              │
   │  file: banner.jpg (5MB)           │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ Multer parse file    │                  │
   │                        │ Detect MIME type     │                  │
   │                        │                     │                   │
   │                        │ if IMAGE:           │                   │
   │                        │   sharp → WebP      │                   │
   │                        │   Sizes:            │                   │
   │                        │   • desktop (1920)  │                   │
   │                        │   • tablet (1024)   │                   │
   │                        │   • mobile (640)    │                   │
   │                        │   • preview (320)   │                   │
   │                        │   • preload (32)    │                   │
   │                        │                     │                   │
   │                        │ if VIDEO:           │                   │
   │                        │   ffmpeg compress   │                   │
   │                        │                     │                   │
   │                        │ Generate UUID       │                   │
   │                        │ filename            │                   │
   │                        │ Save files ─────────│──────────────────▶│
   │                        │ Save DB record      │                   │
   │                        └──────────┬──────────┘                   │
   │  {_id, file_name, file_path,      │                              │
   │   mime_type, size}                │                              │
   │◀──────────────────────────────────│                              │
   │                                   │                              │
   │  DELETE /file/{id}                │                              │
   │──────────────────────────────────▶│                              │
   │                        ┌──────────┴──────────┐                   │
   │                        │ 1. Delete physical  │                   │
   │                        │    files (all sizes) │──────────────────▶│
   │                        │ 2. Delete DB record │                   │
   │                        └──────────┬──────────┘                   │
   │  "Xóa file thành công"           │                              │
   │◀──────────────────────────────────│                              │
```

---

## Tổng hợp trạng thái các Flow

| # | Flow | Status | Ghi chú |
|---|------|--------|---------|
| 1 | Đăng ký tài khoản | 🟡 | Thêm profile fields, validate dynamic |
| 2 | Đăng nhập | 🟢 | Hoạt động |
| 3 | Quên mật khẩu | 🟢 | Hoạt động |
| 4 | Luồng thi chính | 🟡 | Tách ExamParticipant, nhiều lượt, tự luận |
| 4b | Thi lại (retry) | 🔴 | Mới — cần exam_participant |
| 4c | Lịch sử lượt thi | 🔴 | Mới — cần exam_participant |
| 5 | Admin quản lý kỳ thi | 🟡 | Config-driven question count |
| 6 | Admin ngân hàng câu hỏi | 🟡 | Thêm type ESSAY + Import Excel |
| 7 | Thống kê & Export | 🟡 | Group trường học, THCS/THPT, nhiều lượt |
| 7d | Public Counter | 🔴 | Mới — counter lượt tham gia |
| 8 | CMS Content Page | 🔴 | Mới — toàn bộ module |
| 9 | Config Website | 🟡 | Mở rộng Config-First fields |
| 10 | Upload & File | 🟢 | Hoạt động |

---

## Middleware Pipeline

Mọi request đi qua pipeline sau:

```
Request ──▶ CORS ──▶ BodyParser ──▶ Compression ──▶ Router
                                                      │
                                              ┌───────┴───────┐
                                              │               │
                                         Public API      Protected API
                                              │               │
                                              │         ┌─────┴─────┐
                                              │         │  verify() │
                                              │         │  JWT auth │
                                              │         └─────┬─────┘
                                              │               │
                                              │         ┌─────┴──────┐
                                              │         │            │
                                              │     User API    Admin API
                                              │         │            │
                                              │         │     ┌──────┴──────┐
                                              │         │     │verifyAdmin()│
                                              │         │     │check isAdmin│
                                              │         │     └──────┬──────┘
                                              │         │            │
                                              ▼         ▼            ▼
                                          Controller Handler
                                              │
                                              ▼
                                      ┌──────────────┐
                                      │   Provider   │
                                      │ (business    │
                                      │  logic)      │
                                      └──────┬───────┘
                                              │
                                              ▼
                                      ┌──────────────┐
                                      │  ResponseDTO │
                                      │ {status,     │
                                      │  message,    │
                                      │  responseData│
                                      │  violations} │
                                      └──────────────┘
                                              │
                                              ▼
                                          Response
```

### Phân loại API theo Auth:

```
┌────────────────────────────────────────────────────────┐
│                      PUBLIC (Không cần auth)            │
│  GET  /website-config                                   │
│  GET  /content-page/public                              │
│  GET  /statistics/total-participants                    │
│  POST /auth/login                                       │
│  POST /auth/register                                    │
│  POST /auth/otp/verify                                  │
│  POST /auth/otp/resend                                  │
│  POST /auth/forgot-password                             │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                 🔒 USER (verify JWT)                    │
│  GET  /user/myInfo                                      │
│  PUT  /user/myInfo                                      │
│  GET  /user/exam                                        │
│  PUT  /user/exam/{id}/register                          │
│  PUT  /user/exam/{id}/begin                             │
│  GET  /user/exam/{id}/details                           │
│  PUT  /user/exam/{id}/submit                            │
│  GET  /user/exam/{id}/result                            │
│  GET  /user/exam/{id}/attempts                          │
│  GET  /user/exam/{id}/history                           │
│  POST /auth/reset-password                              │
│  GET  /file/{id}                                        │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│              🔒🔑 ADMIN (verify + verifyAdmin)          │
│  GET/POST    /exam                                      │
│  GET/PUT/DEL /exam/{id}                                 │
│  GET/PUT     /exam/{id}/templates                       │
│  GET/POST    /question-bank                             │
│  GET         /question-bank/{id}                        │
│  POST        /question-bank/{id}/copy                   │
│  PUT         /question-bank/{id}/delete                 │
│  POST        /question-bank/import                      │
│  GET         /user                                      │
│  GET/PUT     /user/{id}                                 │
│  PUT         /user/{id}/delete                          │
│  GET/POST    /file                                      │
│  POST        /file/upload                               │
│  DELETE      /file/{id}                                 │
│  PUT         /website-config                            │
│  GET/POST    /content-page                              │
│  GET/PUT/DEL /content-page/{id}                         │
│  GET         /statistics/exam/{id}/participant           │
│  GET         /statistics/exam/{id}/participant/{pid}     │
│  GET         /statistics/exam/{id}/participant/export    │
│  GET         /statistics/exam/{id}/unit                  │
│  GET         /statistics/exam/{id}/unit/export           │
└────────────────────────────────────────────────────────┘
```
