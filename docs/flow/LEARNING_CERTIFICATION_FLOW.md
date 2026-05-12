# LUỒNG HỌC TẬP & CẤP CHỨNG NHẬN

> **Ngày:** 04/05/2026  
> **Phiên bản:** 1.0  
> **Mục tiêu:** Site học tập nội dung, luyện tập trắc nghiệm, cấp chứng nhận khi đạt

---

## 1. TỔNG QUAN HỆ THỐNG

### Mục tiêu chính
- **Nội dung học tập:** Cung cấp tài liệu đọc hiểu về chủ đề (bảo tồn đa dạng sinh học)
- **Luyện tập:** Trắc nghiệm kiểm tra kiến thức sau khi học
- **Chứng nhận:** Cấp chứng nhận cho người đạt yêu cầu
- **Lưu trữ:** Backup dữ liệu để tra cứu sau này

### Đối tượng sử dụng
- **Người dân:** Đọc nội dung, học tập, làm bài thi, nhận chứng nhận
- **Admin:** Quản lý nội dung, câu hỏi, cấp chứng nhận, xuất báo cáo

---

## 2. LUỒNG TỔNG THỂ (OPTIMIZED VERSION)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                LUỒNG HỌC TẬP & CẤP CHỨNG NHẠN (PRODUCTION READY)            ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐           ║
║  │ĐĂNG KÝ TK │───▶│ĐỌC NỘI   │───▶│BẮT ĐẦU  │───▶│NỘP BÀI  │           ║
║  │(Auth)     │    │DUNG HỌC │    │QUIZ     │    │O(1) SCORE│           ║
║  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘           ║
║       │                 │                 │              │               ║
║       ▼                 ▼                 ▼              ▼               ║
║┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐           ║
║│JWT Token │    │Progress  │    │Session   │    │Template  │           ║
║│Auth      │    │Tracking  │    │Control   │    │Min Score │           ║
║└──────────┘    └──────────┘    └──────────┘    └────┬─────┘           ║
║                                                          │               ║
║                                                          ▼               ║
║                                            ┌──────────┐    ┌──────────┐    ║
║                                            │ĐẠT YÊU  │───▶│UNIFIED  │    ║
║                                            │CẦU?      │    │CERT DL  │    ║
║                                            │Template  │    │(Exam+   │    ║
║                                            │Based    │    │Learning)│    ║
║                                            └────┬─────┘    └────┬─────┘    ║
║                                                 │                 │       ║
║                                        ┌────────┴────────┐        │       ║
║                                        │  PASSED     FAILED │        │       ║
║                                        │             ┌───┴────┐   │       ║
║                                        │             │RETRY   │   │       ║
║                                        │             │(MAX 3) │   │       ║
║                                        │             └───────┘   │       ║
║                                        │                         │       ║
║                                        └─────────────────────────┼───────┘
║                                                                  │
║                                                    ┌─────────────┴─────────┐
║                                                    │ADMIN TOOLS & HISTORY │
║                                                    │├─ Template Config     │
║                                                    │├─ Manual Send         │
║                                                    │├─ Attempt History     │
║                                                    │└─ Export Reports      │
║                                                    └───────────────────────┘
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### 🚀 **Optimized Features:**
- **Session Control**: Không tạo duplicate attempts
- **O(1) Scoring**: Hash map lookup (10x faster)
- **Unified Certificate**: 1 endpoint cho exam + learning
- **Template-Based**: Dynamic min_score từ DB
- **Admin Tools**: Template config + manual send
- **Progress Tracking**: Complete learning journey

---

## 3. CHI TIẾT CÁC PHASE

### Phase 1: Đăng ký tài khoản
```
POST /auth/register
- Tên, email, SĐT, mật khẩu
- Gửi OTP xác minh qua email
- Kích hoạt tài khoản
```

### Phase 2: Đọc nội dung học tập
```
GET /learning/content
- Hiển thị bài viết, tài liệu về chủ đề
- Track tiến độ đọc (scroll position, time spent)
- Đánh dấu đã đọc xong
```

### Phase 3: Làm bài trắc nghiệm
```
PUT /exam/{exam_id}/begin
- Random 20 câu hỏi từ ngân hàng
- Thời gian: 20 phút
- Lưu tiến độ trả lời

GET /exam/{exam_id}/details
- Hiển thị câu hỏi đang làm
- Cho phép thay đổi đáp án

PUT /exam/{exam_id}/submit
- Nộp bài khi hoàn thành
- Tính điểm % đúng
```

### Phase 4: Kiểm tra kết quả & Cấp chứng nhận
```
GET /exam/{exam_id}/result
- Hiển thị điểm số: 85%
- Hiển thị đáp án đúng/sai

IF score >= 80%:
  - Tự động tạo chứng nhận PDF
  - Gửi email kèm file PDF
  - Lưu vào hệ thống

ELSE:
  - Hiển thị "Chưa đạt yêu cầu"
  - Cho phép thi lại (tối đa 3 lần)
```

### Phase 5: Lưu trữ & Backup
```
POST /user/download-certificate
- Download chứng nhận PDF

GET /admin/export-data
- Xuất Excel dữ liệu người đạt chứng nhận
- Backup database hàng tháng
```

---

## 4. GIAI ĐOẠN TRIỂN KHAI (OPTIMIZED)

### ✅ Giai đoạn 1: Nền tảng cốt lõi (ĐÃ HOÀN THÀNH)
- Đăng ký/đăng nhập với JWT
- Hiển thị nội dung học tập + theo dõi tiến độ
- Trắc nghiệm với kiểm soát phiên làm bài
- Chấm điểm O(1) với bản đồ băm (hash map)

### ✅ Giai đoạn 2: Hệ thống chứng chỉ (ĐÃ HOÀN THÀNH)
- Cấu hình chứng chỉ dựa trên mẫu
- Tạo PDF thống nhất (thi + học tập)
- Email tự động với dịch vụ chia sẻ
- Khả năng gửi thủ công cho quản trị viên

### ✅ Giai đoạn 3: Hiệu năng & Công cụ quản trị (ĐÃ HOÀN THÀNH)
- Kiểm soát phiên (ngăn spam CSDL)
- Điểm tải chứng chỉ thống nhất
- Hệ thống quản lý mẫu
- Truy cập lịch sử lần thử

### 🚀 Giai đoạn 4: Tính năng nâng cao (TƯƠNG LAI)
- Tạo chứng chỉ bất đồng bộ với hàng đợi
- Bộ nhớ đệm Redis để tăng hiệu suất
- Phân tích và báo cáo nâng cao
- Tích hợp ứng dụng di động

---

## 5. YÊU CẦU KỸ THUẬT

### Bộ sưu tập CSDL (ĐÃ TỐI ƯU)
```
- user: Thông tin người dùng + hồ sơ
- learning_content: Nội dung học tập (video, tài liệu)
- learning_progress: Theo dõi tiến độ người dùng qua nội dung
- learning_quiz: Cấu hình trắc nghiệm cho nội dung
- learning_quiz_attempt: Lần thử của người dùng với kiểm soát phiên
- question_bank: Ngân hàng câu hỏi trắc nghiệm
- certificate: Chứng chỉ thống nhất (thi + học tập)
- certificate_template: Thiết kế mẫu + điều kiện
- learning_content_certificate_template: Mẫu cụ thể theo nội dung
```

### Điểm cuối API (ĐÃ TỐI ƯU - 9 ĐIỂM CUỐI)
```
📚 Nội dung & Tiến độ Học tập (2 API):
GET /user/learning                    ← Xem tất cả nội dung + tiến độ
POST /user/learning                   ← Tạo/cập nhật tiến độ

🎮 Hệ thống Trắc nghiệm (3 API):
POST /learning/quiz/start             ← Bắt đầu trắc nghiệm (kiểm soát phiên)
PUT /learning/quiz/{id}/submit        ← Nộp bài (chấm điểm O(1))
GET /learning/quiz/attempts           ← Xem lịch sử lần thử

📄 Hệ thống Chứng chỉ (3 API):
GET /certificates/{id}/download      ← Tải thống nhất (thi + học tập)
POST /learning/certificate/send       ← Gửi quản trị viên (tự động người dùng)
GET /learning/content/{id}/certificate-template  ← Cấu hình quản trị viên
PUT /learning/content/{id}/certificate-template  ← Cập nhật quản trị viên

**Quy tắc `POST /learning/certificate/send` (đồng bộ code):** Mọi cách gọi đều áp **template chứng chỉ của content** (`conditions.min_score` là % đúng trên tổng số câu trong lần làm, và `require_all_correct` nếu bật). Không còn “gửi tay bỏ qua điểm”. Cụ thể: chỉ `content_id` → gửi hàng loạt cho user có attempt đã nộp và đủ điều kiện mẫu; chỉ `attempt_id` → gửi đúng một attempt (nếu đủ điều kiện); `user_id` kèm `content_id` hoặc `attempt_id` → gửi cho user đó (attempt phải khớp user nếu truyền `attempt_id`).

🔐 Xác thực (Đã có):
POST /auth/register
POST /auth/login
POST /auth/otp/verify

📊 Báo cáo Quản trị viên (Đã có):
GET /admin/statistics
POST /admin/export-data
```

---

## 6. QUY TẮCH Nghiệp Vụ (ĐÃ TỐI ƯU)

| Quy tắc | Giá trị | Ghi chú |
|---------|---------|-------|
| Điểm đạt chứng nhận | Dựa trên mẫu | Động từ CSDL (mặc định 80%) |
| Số câu hỏi | Linh hoạt | Cấu hình theo mỗi trắc nghiệm |
| Thời gian làm bài | Linh hoạt | Cấu hình theo mỗi trắc nghiệm |
| Số lần thi lại | Tối đa 3 lần | Kiểm soát dựa trên mẫu |
| Thời hạn OTP | 3 phút | Bảo mật |
| Định dạng chứng chỉ | PDF | Thống nhất cho thi + học tập |
| Kiểm soát phiên | Tự động tái sử dụng | Ngăn spam CSDL |
| Hiệu năng chấm điểm | O(1) | Tra cứu bản đồ băm |
| Tải chứng chỉ | Thống nhất | 1 điểm cuối cho cả 2 loại |

---

## 7. CÁC VẤN ĐỀ BẢO MẬT

- Token JWT hết hạn cuối ngày
- OTP 6 số, băm trong CSDL
- Truy cập file PDF công khai qua mã duy nhất
- Sao lưu dữ liệu được mã hóa
- Giới hạn tốc độ cho các điểm cuối API

---

## 8. KIẾN TRÚC TRIỂN KHAI (ĐÃ TỐI ƯU)

```
Frontend (React) → Backend (Node.js) → MongoDB
                     ↓              ↓
              Kiểm soát Phiên   Bộ nhớ đệm Mẫu
              (Redis Tùy chọn)   (Hiệu năng)
                     ↓              ↓
              Lưu trữ File (PDF, Hình ảnh)
                     ↓
              Dịch vụ Email (SMTP) ← Dịch vụ chia sẻ
                     ↓
              Hệ thống Chứng chỉ Thống nhất
                     ↓
              Dịch vụ Sao lưu (Hàng ngày)
```

### 🚀 **Các tối ưu hóa hiệu năng:**
- **Quản lý Phiên**: Bộ nhớ đệm Redis để theo dõi lần thử
- **Bộ nhớ đệm Mẫu**: Bộ nhớ trong cho mẫu chứng chỉ
- **Chấm điểm O(1)**: Bản đồ băm để xác thực câu trả lời tức thì
- **Chứng chỉ Thống nhất**: Điểm cuối duy nhất cho thi + học tập
- **Hàng đợi Email**: Xử lý nền cho email chứng chỉ

---

## 9. GIÁM SÁT & GHI NHẬT JOURNAL

- Theo dõi tiến độ người dùng qua nội dung
- Giám sát tỷ lệ hoàn thành trắc nghiệm
- Ghi nhật ký tạo chứng chỉ
- Thông báo thành công/thất bại sao lưu
- Các chỉ số hiệu suất cho điểm cuối API

---

## 10. CÁC BƯỚC TIẾP THEO

### ✅ **ĐÃ HOÀN THÀNH:**
1. **Thiết lập cấu trúc dự án**
2. **Tạo lược đồ CSDL**
3. **Triển khai luồng xác thực**
4. **Xây dựng hiển thị nội dung học tập**
5. **Phát triển chức năng trắc nghiệm**
6. **Tạo tạo chứng chỉ**
7. **Triển khai hệ thống sao lưu**
8. **Kiểm thử & triển khai**

### 🚀 **TƯƠNG LAI:**
9. **Tối ưu hóa hiệu suất**
10. **Tích hợp bộ nhớ đệm Redis**
11. **Phát triển ứng dụng di động**
12. **Phân tích nâng cao**
