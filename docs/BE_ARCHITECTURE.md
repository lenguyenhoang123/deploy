# SHTT Online Exam Backend — Tài liệu Kiến trúc Hệ thống

> **Phiên bản:** 1.0  
> **Cập nhật lần cuối:** 27/03/2026  
> **Tác giả gốc:** Long Nguyen Phuc  
> **Tài liệu bởi:** AI System Architect

---

## Mục lục

1. [Tổng quan dự án (Overview)](#1-tổng-quan-dự-án-overview)
2. [Tech Stack & Core Libraries](#2-tech-stack--core-libraries)
3. [Kiến trúc hệ thống (System Architecture)](#3-kiến-trúc-hệ-thống-system-architecture)
4. [Cấu trúc thư mục cốt lõi (Directory Structure)](#4-cấu-trúc-thư-mục-cốt-lõi-directory-structure)
5. [Design Patterns & Quy chuẩn (Patterns & Conventions)](#5-design-patterns--quy-chuẩn-patterns--conventions)
6. [Luồng dữ liệu chính (Main Data Flow)](#6-luồng-dữ-liệu-chính-main-data-flow)
7. [Các điểm cần lưu ý (Gotchas / Technical Debt)](#7-các-điểm-cần-lưu-ý-gotchas--technical-debt)

---

## 1. Tổng quan dự án (Overview)

**SHTT Online Exam** là hệ thống thi trắc nghiệm trực tuyến được xây dựng cho **Phòng ban Sở hữu Trí tuệ**. Hệ thống cho phép:

- **Quản trị viên (Admin):**
  - Quản lý ngân hàng câu hỏi (Question Bank) với 3 mức độ: Dễ / Trung bình / Khó.
  - Tạo kỳ thi với đề thi tự động random câu hỏi theo mức độ và ưu tiên.
  - Quản lý người dùng (kích hoạt, vô hiệu hoá, xoá).
  - Xem thống kê kết quả thi (theo cá nhân, theo đơn vị) và xuất Excel.
  - Upload file (hình ảnh, video, audio) đính kèm câu hỏi.
  - Cấu hình giao diện website (logo, banner, thông tin liên hệ).

- **Người dùng (User):**
  - Đăng ký tài khoản → xác minh OTP qua email → đăng nhập.
  - Đăng ký thi, làm bài thi trắc nghiệm trong thời gian quy định.
  - Xem kết quả thi cá nhân.
  - Quên mật khẩu → reset qua OTP email.

**Database:** MongoDB  
**API Style:** RESTful API với versioning (`/api/v1.0/...`)  
**Triển khai:** Docker container, hỗ trợ clustering (multi-worker) ở production.

---

## 2. Tech Stack & Core Libraries

### Runtime & Language

| Công nghệ     | Phiên bản yêu cầu | Mô tả                       |
| -------------- | ------------------ | ---------------------------- |
| **Node.js**    | >= 20.1.0          | JavaScript runtime           |
| **TypeScript** | (devDependency)    | Typed superset of JavaScript |
| **npm**        | >= 10.7.0          | Package manager              |
| **pnpm**       | (khuyến nghị)      | Quản lý dependency           |

### Framework & Server

| Thư viện                       | Vai trò                                                     |
| ------------------------------ | ----------------------------------------------------------- |
| **express** `^4.19.2`          | HTTP framework chính                                        |
| **express-automatic-routes**   | Auto-import controllers theo cấu trúc thư mục (file-based routing) |
| **cors**                       | Cross-Origin Resource Sharing                                |
| **compression**                | Nén response (gzip)                                         |
| **body-parser**                | Parse request body JSON                                     |

### Database

| Thư viện         | Vai trò                         |
| ---------------- | ------------------------------- |
| **mongoose** `^8.5.1` | ODM (Object Document Mapper) cho MongoDB |
| **mongodb** `^6.8.1`  | Native MongoDB driver           |

### Xác thực & Bảo mật

| Thư viện            | Vai trò                              |
| ------------------- | ------------------------------------ |
| **jsonwebtoken**    | JWT token cho authentication         |
| **bcryptjs**        | Hash & compare password/OTP          |
| **otp-generator**   | Sinh mã OTP 6 chữ số                |
| **express-validator** | Validation request body            |
| **validator**       | Validate email, phone number         |

### File & Media Processing

| Thư viện         | Vai trò                              |
| ---------------- | ------------------------------------ |
| **multer**       | Upload file (multipart/form-data)    |
| **sharp**        | Nén và convert ảnh sang WebP         |
| **fluent-ffmpeg** | Nén video                           |
| **mime**         | Xác định MIME type                   |
| **uuid**         | Sinh tên file duy nhất (UUID v4)     |

### Tiện ích khác

| Thư viện              | Vai trò                                 |
| --------------------- | --------------------------------------- |
| **nodemailer**        | Gửi email (OTP, reset password)         |
| **exceljs**           | Xuất file Excel (thống kê)              |
| **dayjs**             | Xử lý ngày tháng                       |
| **nconf**             | Quản lý config theo environment          |
| **node-schedule**     | Lập lịch tác vụ                         |
| **swagger-jsdoc** + **swagger-ui-express** | API documentation     |
| **slugify**           | Tạo slug                               |
| **module-alias**      | Path alias (`#providers/*`, `#models/*`) |
| **cli-color**         | Tô màu log trong terminal               |
| **cross-env-file**    | Load biến môi trường từ file JSON        |

### DevDependencies chính

| Thư viện       | Vai trò            |
| -------------- | ------------------ |
| **nodemon**    | Hot reload khi dev |
| **jest**       | Unit testing       |
| **ts-node**    | Chạy TypeScript trực tiếp |

---

## 3. Kiến trúc hệ thống (System Architecture)

### 3.1. Mô hình: **Layered Architecture (3-Layer)**

Dự án áp dụng kiến trúc **phân tầng 3 lớp (Layered Architecture)** kết hợp với **Provider Pattern** (tương đương Repository Pattern):

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (Frontend)                 │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP Request
                        ▼
┌─────────────────────────────────────────────────────┐
│              MIDDLEWARE LAYER                        │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │  auth.ts  │ │response.ts│ │ query-filter.ts  │   │
│  └──────────┘ └──────────┘ └───────────────────┘   │
│  ┌──────────────────┐                               │
│  │   validator.ts    │                               │
│  └──────────────────┘                               │
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│       CONTROLLER LAYER (Presentation Layer)         │
│                                                     │
│   controllers/api/v1.0/                             │
│   ├── auth/    (login, register, OTP, reset-pw)     │
│   ├── exam/    (CRUD kỳ thi, templates)             │
│   ├── user/    (CRUD người dùng, myInfo)            │
│   ├── question-bank/ (CRUD câu hỏi)                │
│   ├── file/    (upload, download, delete)           │
│   ├── statistics/ (thống kê kết quả thi)            │
│   └── website-config/ (cấu hình website)            │
│                                                     │
│   * File-based routing (express-automatic-routes)   │
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│        PROVIDER LAYER (Business + Data Access)      │
│                                                     │
│   providers/                                        │
│   ├── authProvider.ts       (login, OTP verify)     │
│   ├── examProvider.ts       (exam business logic)   │
│   ├── userProvider.ts       (user validation)       │
│   ├── questionBankProvider.ts (random questions)    │
│   ├── fileProvider.ts       (file CRUD)             │
│   └── websiteConfigProvider.ts                      │
│                                                     │
│   Tất cả kế thừa từ: BaseProvider<T, M>            │
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│           BASE PROVIDER (Abstract Data Layer)       │
│                                                     │
│   templates/base/baseProvider.ts                    │
│   ├── getAll()      (paginated query)               │
│   ├── getById()                                     │
│   ├── getOne()                                      │
│   ├── post()        (create)                        │
│   ├── put()         (update)                        │
│   ├── delete()                                      │
│   ├── bulkCreate()                                  │
│   ├── bulkUpdate()                                  │
│   └── bulkDelete()                                  │
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│                  MONGOOSE / MongoDB                 │
│                                                     │
│   models/                                           │
│   ├── user.ts          (collection: user)           │
│   ├── userAuth.ts      (collection: user_auth)      │
│   ├── exam.ts          (collection: exam)           │
│   ├── questionBank.ts  (collection: question_bank)  │
│   ├── file.ts          (collection: file)           │
│   ├── websiteConfig.ts (collection: website_config) │
│                                                     │
│   services/database/mongoose.ts (connection)        │
└─────────────────────────────────────────────────────┘
```

### 3.2. Lý do chọn kiến trúc này

- **Đơn giản, dễ hiểu:** Phù hợp với quy mô dự án nhỏ-vừa (1 developer), không cần over-engineering.
- **File-based routing:** Cấu trúc thư mục controller phản ánh trực tiếp URL API, dễ tìm code.
- **BaseProvider pattern:** Tập trung logic CRUD chung vào 1 class duy nhất, các Provider con chỉ cần extend và thêm business logic riêng.
- **Dễ mở rộng:** Thêm resource mới chỉ cần tạo model → provider → controller folder.

### 3.3. Deployment Architecture

```
                    Production Mode
┌──────────────────────────────────────┐
│          Primary Process             │
│  ┌─────────────────────────────┐     │
│  │   Cluster Manager           │     │
│  │   (fork workers = CPU cores)│     │
│  └────────┬──┬──┬──────────────┘     │
│           │  │  │                    │
│    ┌──────┘  │  └──────┐             │
│    ▼         ▼         ▼             │
│ Worker 1  Worker 2  Worker N         │
│ (Express) (Express) (Express)        │
│    │         │         │             │
│    └────┬────┘─────────┘             │
│         ▼                            │
│      MongoDB                         │
└──────────────────────────────────────┘
```

- **Development:** Single-process, hot reload với `nodemon`.
- **Staging/Production:** Node.js **Cluster mode** — fork worker theo số CPU cores, tự động restart worker khi bị crash.
- **Containerization:** `Dockerfile` + `docker-compose.yaml` cho deployment.

---

## 4. Cấu trúc thư mục cốt lõi (Directory Structure)

```
shtt-online-exam-backend/
│
├── src/                          # Source code chính
│   ├── index.ts                  # Entry point — setup module alias → gọi startServer()
│   ├── server.ts                 # Khởi tạo Express, middleware, routing, cluster
│   ├── root.ts                   # Export root path và config path
│   │
│   ├── config/                   # Cấu hình theo môi trường
│   │   ├── development.json      # Config cho dev (port, DB, JWT, SMTP, domains)
│   │   └── staging.json          # Config cho staging
│   │
│   ├── constants/                # Hằng số toàn cục
│   │   └── index.ts              # Error codes, messages, MIME types, paths, email templates
│   │
│   ├── controllers/              # ★ FILE-BASED ROUTING — mỗi file = 1 route
│   │   ├── api/v1.0/             # API version 1.0
│   │   │   ├── auth/             # /api/v1.0/auth/*
│   │   │   │   ├── login.ts      # POST /auth/login
│   │   │   │   ├── register.ts   # POST /auth/register
│   │   │   │   ├── forgot-password.ts
│   │   │   │   ├── reset-password.ts
│   │   │   │   └── otp/
│   │   │   │       ├── verify.ts # POST /auth/otp/verify
│   │   │   │       └── resend.ts # POST /auth/otp/resend
│   │   │   │
│   │   │   ├── exam/             # /api/v1.0/exam/*
│   │   │   │   ├── index.ts      # GET (list) + POST (create)
│   │   │   │   └── {id}/
│   │   │   │       ├── index.ts  # GET (detail) + PUT (update) + DELETE
│   │   │   │       └── templates.ts  # GET /exam/:id/templates
│   │   │   │
│   │   │   ├── user/             # /api/v1.0/user/*
│   │   │   │   ├── index.ts      # GET (list) — admin only
│   │   │   │   ├── myInfo.ts     # GET /user/myInfo
│   │   │   │   ├── {id}.ts       # GET /user/:id
│   │   │   │   └── {id}/
│   │   │   │       ├── index.ts  # PUT /user/:id
│   │   │   │       └── delete.ts # DELETE /user/:id/delete
│   │   │   │
│   │   │   ├── question-bank/    # /api/v1.0/question-bank/*
│   │   │   │   ├── index.ts      # GET + POST
│   │   │   │   └── {id}/
│   │   │   │       ├── index.ts  # GET + PUT
│   │   │   │       ├── delete.ts # DELETE (soft delete)
│   │   │   │       └── copy.ts   # POST /question-bank/:id/copy
│   │   │   │
│   │   │   ├── file/             # /api/v1.0/file/*
│   │   │   │   ├── index.ts      # GET (list)
│   │   │   │   ├── upload.ts     # POST /file/upload
│   │   │   │   └── {id}/
│   │   │   │       └── index.ts  # GET + DELETE
│   │   │   │
│   │   │   ├── statistics/       # /api/v1.0/statistics/*
│   │   │   │   └── exam/{exam_id}/  # GET /statistics/exam/:exam_id
│   │   │   │
│   │   │   └── website-config/   # /api/v1.0/website-config/*
│   │   │       └── index.ts      # GET + PUT
│   │   │
│   │   └── logs/                 # /logs/*
│   │       └── getAllWithinTimeRange.ts  # GET logs (admin, protected)
│   │
│   ├── models/                   # ★ MONGOOSE SCHEMAS & INTERFACES
│   │   ├── user.ts               # User — thông tin người dùng (tên, email, phone, đơn vị)
│   │   ├── userAuth.ts           # UserAuth — lưu password hash & OTP (tách biệt user)
│   │   ├── exam.ts               # Exam — kỳ thi (template, participants, answers)
│   │   ├── questionBank.ts       # QuestionBank — ngân hàng câu hỏi (3 level, answers 2-4)
│   │   ├── file.ts               # File — metadata file đã upload
│   │   └── websiteConfig.ts      # WebsiteConfig — cấu hình giao diện website
│   │
│   ├── providers/                # ★ BUSINESS LOGIC + DATA ACCESS (Provider/Repository)
│   │   ├── authProvider.ts       # Login (JWT), verify OTP → activate user
│   │   ├── userProvider.ts       # Validate user (active, deleted), fetch user
│   │   ├── examProvider.ts       # Logic thi: template, participant, scoring, statistics
│   │   ├── questionBankProvider.ts  # Random câu hỏi theo level + priority
│   │   ├── fileProvider.ts       # CRUD file metadata (kế thừa BaseProvider)
│   │   └── websiteConfigProvider.ts # CRUD config (kế thừa BaseProvider)
│   │
│   ├── middlewares/              # ★ EXPRESS MIDDLEWARES
│   │   ├── auth.ts               # JWT verify, verifyToken, verifyAdmin
│   │   ├── response.ts           # Gắn res.sendOk(), res.sendError(), res.sendErrorStatus()
│   │   ├── validator.ts          # Wrapper express-validator → return violations
│   │   └── query-filter.ts       # Parse query string → req.payload (filter, sort, paginate)
│   │
│   ├── dto/                      # ★ DATA TRANSFER OBJECTS
│   │   ├── apiResponseDTO.ts     # Format response chuẩn {message, responseData, status, violations}
│   │   ├── MeUErrorDTO.ts        # Custom Error class (errorCode, errorType, errorData)
│   │   └── violationDTO.ts       # Violation object cho error response
│   │
│   ├── services/                 # ★ UTILITY & CROSS-CUTTING SERVICES
│   │   ├── mailService.ts        # Gửi email qua SMTP (nodemailer)
│   │   ├── excelExportService.ts # Xuất file Excel (exceljs)
│   │   ├── statisticsService.ts  # Sort, rank, paginate thống kê kết quả thi
│   │   │
│   │   ├── database/             # Database utilities
│   │   │   ├── mongoose.ts       # MongoDB connection (singleton pattern)
│   │   │   └── query-string.ts   # Parse filter string → MongoDB query operators
│   │   │
│   │   ├── data-handlers/        # Data transformation utilities
│   │   │   ├── helperService.ts  # capitalizeFirstLetter, getBoolean
│   │   │   └── validatorService.ts  # Validation rules cho từng entity
│   │   │
│   │   ├── file-system-handlers/ # File system operations
│   │   │   ├── uploadFileService.ts  # Multer config (storage, UUID filename)
│   │   │   ├── handleFileService.ts  # Delete file, format size, wrap compression
│   │   │   ├── compressFileService.ts # Worker process nén ảnh/video
│   │   │   └── logService.ts     # Ghi log ra file hệ thống (theo ngày/giờ)
│   │   │
│   │   └── interfaces/           # TypeScript interfaces
│   │       ├── iapi.ts           # Req, Res, QueryReq, AuthPayload, RequestPayload
│   │       ├── ienv.ts           # Environment type
│   │       └── istatistics.ts    # IResult, IUnitStatistics, IParticipantStatistics
│   │
│   └── templates/                # Templates tĩnh
│       ├── base/
│       │   └── baseProvider.ts   # ★ Abstract BaseProvider<T, M> — CRUD operations
│       ├── email/
│       │   ├── registerOTP.html  # Template email xác minh đăng ký
│       │   └── resetPassword.html # Template email reset password
│       ├── excel/
│       │   └── statisticsTemplate.ts  # Header định nghĩa cho xuất Excel
│       └── swagger/
│           └── config.ts         # Swagger/OpenAPI configuration
│
├── storage/                      # ★ LƯU TRỮ TĨNH (logs, swagger, uploaded files)
│   ├── logs/                     # Log files (theo ngày)
│   │   ├── 27032026/             # Logs ngày 27/03/2026
│   │   └── database/            # Database operation logs
│   └── swagger/
│       └── swagger-output.json   # Generated Swagger spec
│
├── tests/                        # Unit tests
│   └── hello.test.ts
│
├── cicd/                         # CI/CD scripts
│   ├── build.sh
│   ├── clean.sh
│   └── deploy.sh
│
├── seed.ts                       # Script seed dữ liệu mẫu (admin user)
├── builder.ts                    # Build script (tsc compile)
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yaml
├── nodemon.json
└── .gitlab-ci.yml                # GitLab CI pipeline
```

---

## 5. Design Patterns & Quy chuẩn (Patterns & Conventions)

### 5.1. Design Patterns đang áp dụng

#### a) **Template Method Pattern / Abstract Base Class** — `BaseProvider`

```typescript
// templates/base/baseProvider.ts
class BaseProvider<ModelInterface, ModelMethods> {
    getAll(), getById(), getOne(), post(), put(), delete(), bulkCreate(), bulkUpdate(), bulkDelete()
}

// Các Provider con kế thừa và mở rộng:
class UserProvider extends BaseProvider<IUser, IUserMethods> { ... }
class ExamProvider extends BaseProvider<IExam, IExamMethods> { ... }
```

- Tất cả CRUD operations chuẩn được định nghĩa ở `BaseProvider`.
- Provider con chỉ cần override hoặc thêm method business logic riêng.

#### b) **File-based Routing** — `express-automatic-routes`

```
controllers/api/v1.0/exam/index.ts       → GET/POST /api/v1.0/exam
controllers/api/v1.0/exam/{id}/index.ts  → GET/PUT/DELETE /api/v1.0/exam/:id
controllers/api/v1.0/exam/{id}/templates.ts → GET /api/v1.0/exam/:id/templates
```

- Cấu trúc thư mục **chính là** route path.
- Thư mục `{id}` map thành route parameter `:id`.
- Mỗi file export default 1 `Resource` object chứa `get`, `post`, `put`, `delete` handlers.

#### c) **Middleware Pattern** — Express Middleware Chain

```typescript
// Ví dụ middleware chain cho 1 route:
get: {
    middleware: [verify, verifyAdmin, queryFilter, requiredFilters(["currentPage", "pageSize"])],
    handler: async (req, res) => { ... }
}
```

- `verify` → Xác thực JWT token.
- `verifyAdmin` → Kiểm tra quyền admin.
- `queryFilter` → Parse query string thành MongoDB filter.
- `requiredFilters()` → Factory function trả về middleware kiểm tra filter bắt buộc.
- `validate()` → Higher-order function wrap express-validator rules.

#### d) **Factory Pattern** — Validator Middleware

```typescript
// middlewares/validator.ts
export const validate = (validations: ContextRunner[]) => 
    async (req, res, next) => { ... }

// Sử dụng:
export const validateLoginEntry = validate(validateLogin());
export const validateExamEntry = validate(validateExam());
```

#### e) **Singleton Pattern** — MongoDB Connection

```typescript
// services/database/mongoose.ts
if (mongoose.connection.readyState === 1) {
    return mongoose; // Đã connect → trả về instance hiện tại
}
```

#### f) **DTO Pattern** (Data Transfer Object)

```typescript
// dto/apiResponseDTO.ts — Format response chuẩn
{
    message: string,
    message_en: string,
    responseData: any,
    status: "success" | "fail",
    timeStamp: string,
    violations: ViolationDTO[]
}
```

#### g) **Worker Process Pattern** — File Compression

```typescript
// services/file-system-handlers/compressFileService.ts
// Chạy nén ảnh/video trong child_process riêng (fork) để không block main thread
process.on("message", async (payload) => { ... });
```

### 5.2. Quy chuẩn đặt tên (Naming Conventions)

| Thành phần       | Quy chuẩn                              | Ví dụ                                    |
|------------------|-----------------------------------------|------------------------------------------|
| **File**         | `camelCase.ts`                          | `examProvider.ts`, `helperService.ts`     |
| **Class**        | `PascalCase`                            | `ExamProvider`, `MailService`             |
| **Interface**    | `I` prefix + `PascalCase`              | `IExam`, `IUser`, `IQuestionBank`        |
| **Type (Model)** | `PascalCase` + `Model` suffix          | `ExamModel`, `UserModel`                 |
| **Methods**      | `camelCase`                             | `getTemplateQuestions`, `validateUserId`  |
| **Enum**         | `PascalCase` (values: `UPPER_SNAKE`)   | `DifficultyLevels.EASY`, `AuthMethods.PASSWORD` |
| **Constants**    | `UPPER_SNAKE_CASE`                     | `DEFAULT_ERROR_CODE`, `LOG_PATH`          |
| **DB Collection**| `snake_case`                            | `user`, `user_auth`, `question_bank`     |
| **DB Fields**    | `snake_case`                            | `first_name`, `created_at`, `is_admin`   |
| **Route Params** | `{param}` trong folder name            | `{id}`, `{exam_id}`                     |
| **API Path**     | `kebab-case`                            | `/question-bank`, `/website-config`      |
| **Provider**     | `PascalCase` + `Provider` suffix       | `UserProvider`, `ExamProvider`            |

### 5.3. Module Alias (Path Alias)

Dự án sử dụng `module-alias` với prefix `#` để import ngắn gọn:

```typescript
import { UserProvider } from "#providers/userProvider";
import { IExam } from "#models/exam";
import verify from "#middlewares/auth";
import { MeUError } from "#dto/MeUErrorDTO";
import constants from "#constants/index";
import { Req, Res } from "#services/interfaces/iapi";
```

Được khai báo trong cả `tsconfig.json` (paths) và `index.ts` (runtime alias).

---

## 6. Luồng dữ liệu chính (Main Data Flow)

### 6.1. Vòng đời một Request API tiêu biểu

```
Client HTTP Request
       │
       ▼
┌──────────────────────────────┐
│ 1. Express App nhận request  │  server.ts → app.all("/api/*", cors)
│    → CORS check              │
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│ 2. Response Middleware       │  middlewares/response.ts
│    Gắn res.sendOk()         │  → Gắn helper functions vào Response object
│    Gắn res.sendError()      │  → Mọi response đều đi qua apiResponseDTO
│    Gắn res.sendErrorStatus() │
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│ 3. Auto-Route Matching       │  express-automatic-routes
│    URL path → Controller file│  /api/v1.0/exam/:id → controllers/api/v1.0/exam/{id}/index.ts
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│ 4. Route-level Middlewares   │  Định nghĩa trong mỗi Resource handler
│    ├─ verify (JWT auth)      │  → Decode token → req.user = { id, isAdmin }
│    ├─ verifyAdmin            │  → Check req.user.isAdmin === true
│    ├─ queryFilter            │  → Parse query string → req.payload
│    ├─ requiredFilters(...)   │  → Validate bắt buộc currentPage, pageSize
│    └─ validateXxxEntry       │  → express-validator → return 400 nếu lỗi
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│ 5. Controller Handler        │  async (req: Req, res: Res) => { ... }
│    - Lấy data từ req.body    │  
│    - Lấy params từ req.params│
│    - Gọi Provider method     │  → provider.getAll(queryOptions)
│    - Return res.sendOk()     │  → hoặc res.sendError() nếu exception
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│ 6. Provider Layer            │  extends BaseProvider<T, M>
│    - Business logic          │  → Validate ObjectId, check user status
│    - Gọi BaseProvider CRUD   │  → this.getById(), this.post(), this.put()
│    - Populate references     │  → exam.populate("template.questions")
│    - Return data             │
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│ 7. BaseProvider (Mongoose)   │  templates/base/baseProvider.ts
│    - Build Mongoose query    │  → collection.find(where, attributes, {skip, limit, sort})
│    - Execute query           │  → .populate(populates)
│    - Log DB operations       │  → LoggingService.logDBAsync()
│    - Return raw documents    │
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│ 8. MongoDB                   │  services/database/mongoose.ts
│    - Execute query           │  → Trả về documents
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│ 9. Response formatting       │  dto/apiResponseDTO.ts
│    {                         │
│      message: "Thành công",  │
│      message_en: "Success",  │
│      responseData: { ... },  │
│      status: "success",      │
│      timeStamp: "...",       │
│      violations: null        │
│    }                         │
└──────────────────────────────┘
```

### 6.2. Luồng Authentication (Đăng ký → Login)

```
1. POST /auth/register
   → validateRegister middleware
   → Check email/phone trùng
   → userProvider.post() → tạo User (is_active: false)
   → Sinh OTP 6 số
   → userAuthProvider.bulkCreate() → lưu password hash + OTP hash
   → mailService.sendmail() → gửi OTP qua email

2. POST /auth/otp/verify
   → validateVerifyOTPEntry middleware
   → Tìm user theo email
   → So sánh OTP (bcrypt compare)
   → Kiểm tra OTP hết hạn (3 phút)
   → Xoá OTP record, cập nhật is_active = true
   → Trả về JWT token

3. POST /auth/login
   → validateLoginEntry middleware
   → Tìm user theo email
   → validateUser (active, not deleted)
   → Tìm auth record (PASSWORD method)
   → bcrypt compare password
   → Trả về JWT token (expiresIn = cuối ngày)
```

### 6.3. Luồng tạo & làm bài thi

```
1. Admin: POST /exam
   → Tạo kỳ thi (name, start_time, end_time, allowed_time)

2. Admin: POST /exam/:id/templates
   → questionBankProvider.getRandomQuestions(quantity)
   → Phân bổ câu hỏi theo 3 level (EASY/NORMAL/HARD, mỗi loại 1/3)
   → Bổ sung theo priority nếu thiếu
   → Lưu template.questions = [ObjectId array]

3. User: GET /exam/:id/templates
   → Lấy danh sách câu hỏi (ẩn is_correct)
   → Trả về exam_name, allowed_time, questions

4. User: POST /user/exam/:exam_id
   → Đăng ký/nộp bài thi
   → Lưu participant = { user_id, start_time, submit_time, answers[] }

5. GET /statistics/exam/:exam_id
   → Tính điểm, xếp hạng theo đơn vị & cá nhân
   → Hỗ trợ export Excel
```

---

## 7. Các điểm cần lưu ý (Gotchas / Technical Debt)

### 7.1. Bảo mật (Security Concerns)

| # | Vấn đề | Chi tiết | Mức độ |
|---|--------|----------|--------|
| 1 | **Credentials trong config file** | `development.json` chứa DB password, JWT secret, SMTP credentials dưới dạng plaintext. File này được commit vào Git. | **Cao** |
| 2 | **JWT expiry quá rộng** | Token hết hạn vào cuối ngày (`dayjs().endOf("day")`), không có refresh token mechanism thực tế. | Trung bình |
| 3 | **Không có rate limiting** | Không có rate limiter cho login, register, OTP → dễ bị brute force. | **Cao** |
| 4 | **OTP 6 chữ số thuần số** | Chỉ có 1 triệu tổ hợp, hết hạn 3 phút nhưng không giới hạn số lần thử. | Trung bình |

### 7.2. Architecture & Code Smells

| # | Vấn đề | Chi tiết | Đề xuất |
|---|--------|----------|---------|
| 1 | **Provider = Repository + Service** | `ExamProvider` chứa cả business logic phức tạp (scoring, statistics) lẫn data access → vi phạm Single Responsibility. | Tách thành `ExamService` (logic) + `ExamRepository` (data). |
| 2 | **Không có Service Layer riêng biệt** | Controller gọi thẳng Provider. Với các nghiệp vụ phức tạp (register, thi), logic nằm rải rác giữa controller và provider. | Thêm Service layer giữa Controller và Provider. |
| 3 | **Error handling không nhất quán** | Có nơi throw `new Error(...)`, có chỗ throw `new MeUError(...)`. Controller catch bằng `res.sendError({ err: error })` nhưng `sendError` expect `MeUError`. | Thống nhất dùng `MeUError` everywhere, hoặc có global error handler. |
| 4 | **Provider instantiation trong controller** | Mỗi controller tạo `new UserProvider()`, `new ExamProvider()` riêng → không có Dependency Injection container. | Cân nhắc DI container hoặc Singleton provider instances. |
| 5 | **BaseProvider connect DB trong constructor** | `connectMongo()` được gọi trong constructor (async trong sync context) → race condition tiềm ẩn khi query ngay sau khi tạo instance. | Đảm bảo connection đã sẵn sàng trước khi query (await connection). |
| 6 | **`Ref` viết hoa thay vì `ref`** | Trong models, `Ref: collectionName` thay vì `ref: collectionName` → Mongoose ignore, populate sẽ không hoạt động cho `created_by`/`updated_by`. | Sửa thành `ref` (lowercase). |

### 7.3. Testing & Quality

| # | Vấn đề | Chi tiết |
|---|--------|----------|
| 1 | **Gần như không có test** | Chỉ có 1 file `hello.test.ts` placeholder. Không có integration test, API test nào. |
| 2 | **Không có linting** | Không thấy ESLint config. Chỉ có `.prettierrc` cho formatting. |
| 3 | **Console.log trong production code** | Nhiều `console.log()` rải rác, không phải logging service. |

### 7.4. Performance & Scalability

| # | Vấn đề | Chi tiết |
|---|--------|----------|
| 1 | **Statistics tính runtime** | Thống kê thi được tính realtime trên toàn bộ participants → O(n) mỗi request. Nên pre-compute hoặc cache. |
| 2 | **Random câu hỏi load toàn bộ** | `getRandomQuestions()` load tối đa 1000 câu hỏi vào memory rồi mới shuffle → Với dataset lớn sẽ chậm. Có thể dùng `$sample` aggregation của MongoDB. |
| 3 | **Participants lưu embedded trong Exam** | Tất cả participants + answers lưu trong 1 document Exam → Document size sẽ lớn nhanh. Nên tách thành collection riêng. |

### 7.5. Quy chuẩn cần cải thiện

| # | Vấn đề | Chi tiết |
|---|--------|----------|
| 1 | **Bilingual messages** | Có cả `message` (Tiếng Việt) và `message_en` (Tiếng Anh) nhưng không nhất quán — nhiều chỗ chỉ có tiếng Việt. |
| 2 | **Swagger docs chưa đầy đủ** | Một số endpoints có OpenAPI annotations, một số không. Response schema chưa chi tiết. |
| 3 | **Soft delete không nhất quán** | User có `is_deleted` flag, QuestionBank cũng có, nhưng Exam và File thì không → logic filter khác nhau. |
| 4 | **LoggingService mention Sequelize** | `logDBAsync("Sequelize")` nhưng dự án dùng Mongoose → Copy-paste từ project cũ. |

---

> **Kết luận:** Dự án có cấu trúc rõ ràng, dễ hiểu, phù hợp để 1 developer phát triển nhanh. Tuy nhiên, để scale và maintain lâu dài, nên ưu tiên: (1) tách Provider thành Service + Repository, (2) thêm error handling nhất quán, (3) bổ sung test coverage, và (4) di chuyển credentials ra environment variables.
