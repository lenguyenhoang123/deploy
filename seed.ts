/**
 * Seed script — chạy để thêm dữ liệu mẫu vào MongoDB
 *
 * Cách dùng:
 *   npx ts-node -r tsconfig-paths/register seed.ts
 * hoặc thêm vào package.json:
 *   "seed": "cross-env-file -p ./.example_env.json ts-node -r tsconfig-paths/register seed.ts"
 * rồi chạy: pnpm seed
 */

import mongoose, { Schema } from "mongoose";
import { genSaltSync, hashSync } from "bcryptjs";
import { resolve } from "path";
import nconf from "nconf";

// ─── Load config ────────────────────────────────────────────────────────────
const configPath = resolve(__dirname, "src/config", `${process.env.NODE_ENV?.toLowerCase() ?? "development"}.json`);
nconf.argv().env().file({ file: configPath });

// ─── DB Connect ──────────────────────────────────────────────────────────────
async function connectDB() {
    const db = nconf.get("Database") as {
        DB_USER: string; DB_PASS: string; DB_HOST: string;
        DB_PORT: string; DB_AUTHDB: string; DB_DATABASE: string;
    };
    const uri = db.DB_USER && db.DB_PASS
        ? `mongodb://${db.DB_USER}:${db.DB_PASS}@${db.DB_HOST}:${db.DB_PORT}/${db.DB_AUTHDB}`
        : `mongodb://${db.DB_HOST}:${db.DB_PORT}`;
    await mongoose.connect(uri, { dbName: db.DB_DATABASE });
    console.log("✅ Connected to MongoDB");
}

// ─── Models (inline — không import từ src để tránh module-alias) ─────────────

// User
interface IUser {
    first_name: string; middle_name?: string; last_name: string;
    email: string; phone: string;
    unit: { district: string; ward: string };
    is_admin?: boolean; is_active?: boolean; is_deleted?: boolean;
}
const UserSchema = new Schema<IUser>(
    {
        first_name: { type: String, trim: true, required: true },
        middle_name: { type: String, trim: true },
        last_name: { type: String, trim: true, required: true },
        email: { type: String, trim: true, lowercase: true, unique: true, required: true },
        phone: { type: String, unique: true, required: true },
        unit: { district: String, ward: String },
        is_active: { type: Boolean, default: false },
        is_deleted: { type: Boolean, default: false },
        is_admin: { type: Boolean, default: false },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);
const User = mongoose.model<IUser>("user", UserSchema, "user");

// UserAuth
interface IUserAuth { user: mongoose.Types.ObjectId; auth_key: string; auth_method: string; }
const UserAuthSchema = new Schema<IUserAuth>(
    {
        user: { type: Schema.Types.ObjectId, ref: "user" },
        auth_key: { type: String, required: true },
        auth_method: { type: String, enum: ["PASSWORD", "OTP"], required: true },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);
const UserAuth = mongoose.model<IUserAuth>("user_auth", UserAuthSchema, "user_auth");

// WebsiteConfig
interface IWebsiteConfig {
    name?: string; phone?: string; email?: string; website?: string;
    address?: string; theme?: string; is_default?: boolean;
}
const WebsiteConfigSchema = new Schema<IWebsiteConfig>(
    {
        name: String, phone: String, email: String, website: String,
        address: String, theme: String,
        is_default: { type: Boolean, default: false },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);
const WebsiteConfig = mongoose.model<IWebsiteConfig>("website_config", WebsiteConfigSchema, "website_config");

// QuestionBank
interface IAnswer { _id?: mongoose.Types.ObjectId; value: string; is_correct: boolean; }
interface IQuestionBank {
    name: string; level: string; priority: number;
    answers: IAnswer[]; is_deleted?: boolean;
    created_by?: mongoose.Types.ObjectId;
}
const AnswerSchema = new Schema<IAnswer>({ value: { type: String, required: true }, is_correct: { type: Boolean, required: true } }, { _id: true });
const QuestionBankSchema = new Schema<IQuestionBank>(
    {
        name: { type: String, required: true },
        level: { type: String, enum: ["EASY", "NORMAL", "HARD"], required: true },
        priority: { type: Number, required: true },
        answers: { type: [AnswerSchema], required: true },
        is_deleted: { type: Boolean, default: false },
        created_by: Schema.Types.ObjectId,
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);
const QuestionBank = mongoose.model<IQuestionBank>("question_bank", QuestionBankSchema, "question_bank");

// Exam
interface IParticipantAnswer { question_id: mongoose.Types.ObjectId; user_answer?: mongoose.Types.ObjectId; question_answers: mongoose.Types.ObjectId[]; }
interface IParticipant { user_id: mongoose.Types.ObjectId; start_time: Date; submit_time: Date; answers: IParticipantAnswer[]; }
interface ITemplate { name: string; questions: mongoose.Types.ObjectId[]; }
interface IExam { name: string; description?: string; start_time: Date; end_time: Date; allowed_time: number; template: ITemplate; participants: IParticipant[]; created_by?: mongoose.Types.ObjectId; }
const ParticipantAnswerSchema = new Schema<IParticipantAnswer>({ question_id: { type: Schema.Types.ObjectId, required: true }, user_answer: Schema.Types.ObjectId, question_answers: [Schema.Types.ObjectId] }, { _id: false });
const ParticipantSchema = new Schema<IParticipant>({ user_id: { type: Schema.Types.ObjectId, required: true }, start_time: { type: Date, required: true }, submit_time: { type: Date, required: true }, answers: [ParticipantAnswerSchema] }, { _id: false });
const TemplateSchema = new Schema<ITemplate>({ name: { type: String, required: true }, questions: [{ type: Schema.Types.ObjectId, ref: "question_bank" }] }, { _id: true });
const ExamSchema = new Schema<IExam>(
    {
        name: { type: String, required: true }, description: String,
        start_time: { type: Date, required: true }, end_time: { type: Date, required: true },
        allowed_time: { type: Number, required: true },
        template: TemplateSchema, participants: [ParticipantSchema],
        created_by: Schema.Types.ObjectId,
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);
const Exam = mongoose.model<IExam>("exam", ExamSchema, "exam");

// ─── Seed Data ────────────────────────────────────────────────────────────────

async function seedWebsiteConfig() {
    const existing = await WebsiteConfig.findOne({ is_default: true });
    if (existing) { console.log("⏩ WebsiteConfig: đã tồn tại, bỏ qua"); return; }

    await WebsiteConfig.create({
        name: "Cuộc thi trực tuyến bảo tồn đa dạng sinh học",
        phone: "0901234567",
        email: "contact@shtt.edu.vn",
        website: "https://shtt.edu.vn",
        address: "123 Nguyễn Văn Linh, TP.HCM",
        theme: "default",
        is_default: true,
    });
    console.log("✅ WebsiteConfig: đã tạo");
}

async function seedUsers() {
    const ADMIN_EMAIL = "admin@shtt.edu.vn";
    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) { console.log("⏩ Admin user: đã tồn tại, bỏ qua"); return existing._id; }

    const adminUser = await User.create({
        first_name: "Admin",
        last_name: "SHTT",
        email: ADMIN_EMAIL,
        phone: "0901111111",
        unit: { district: "Quận 1", ward: "Phường Bến Nghé" },
        is_admin: true,
        is_active: true,
    });

    const salt = genSaltSync();
    await UserAuth.create({
        user: adminUser._id,
        auth_key: hashSync("Admin@123", salt),
        auth_method: "PASSWORD",
    });
    console.log("✅ Admin user: đã tạo — email: admin@shtt.edu.vn | password: Admin@123");

    // Tạo 5 user thường
    const sampleUsers = [
        { first_name: "Nguyễn", middle_name: "Văn", last_name: "An", email: "an.nguyen@test.com", phone: "0901000001", district: "Quận 1", ward: "Phường 1" },
        { first_name: "Trần", middle_name: "Thị", last_name: "Bình", email: "binh.tran@test.com", phone: "0901000002", district: "Quận 3", ward: "Phường 2" },
        { first_name: "Lê", middle_name: "Minh", last_name: "Cường", email: "cuong.le@test.com", phone: "0901000003", district: "Quận 5", ward: "Phường 3" },
        { first_name: "Phạm", middle_name: "Thu", last_name: "Dung", email: "dung.pham@test.com", phone: "0901000004", district: "Quận 7", ward: "Phường 4" },
        { first_name: "Hoàng", middle_name: "Đức", last_name: "Em", email: "em.hoang@test.com", phone: "0901000005", district: "Bình Thạnh", ward: "Phường 5" },
    ];

    for (const u of sampleUsers) {
        const existUser = await User.findOne({ email: u.email });
        if (existUser) continue;
        const user = await User.create({
            first_name: u.first_name, middle_name: u.middle_name, last_name: u.last_name,
            email: u.email, phone: u.phone,
            unit: { district: u.district, ward: u.ward },
            is_active: true,
        });
        const salt = genSaltSync();
        await UserAuth.create({ user: user._id, auth_key: hashSync("Pass@123", salt), auth_method: "PASSWORD" });
    }
    console.log("✅ Sample users: đã tạo 5 user — password: Pass@123");
    return adminUser._id;
}

async function seedQuestionBank(adminId: mongoose.Types.ObjectId) {
    const count = await QuestionBank.countDocuments({ is_deleted: false });
    if (count >= 10) { console.log(`⏩ QuestionBank: đã có ${count} câu, bỏ qua`); return; }

    const questions: Omit<IQuestionBank, "_id">[] = [
        {
            name: "Đa dạng sinh học là gì?",
            level: "EASY", priority: 1, created_by: adminId,
            answers: [
                { value: "Sự đa dạng của các loài sinh vật sống trên Trái Đất", is_correct: true },
                { value: "Sự đa dạng của các loại khoáng sản", is_correct: false },
                { value: "Sự đa dạng của các hiện tượng thời tiết", is_correct: false },
                { value: "Sự đa dạng của các địa hình", is_correct: false },
            ],
        },
        {
            name: "Loài nào sau đây được xếp vào danh sách đỏ IUCN?",
            level: "NORMAL", priority: 2, created_by: adminId,
            answers: [
                { value: "Hổ Đông Dương", is_correct: true },
                { value: "Chó nhà", is_correct: false },
                { value: "Gà công nghiệp", is_correct: false },
                { value: "Chuột cống", is_correct: false },
            ],
        },
        {
            name: "Rừng nhiệt đới chiếm bao nhiêu % diện tích bề mặt Trái Đất nhưng chứa đến 50% số loài sinh vật?",
            level: "HARD", priority: 3, created_by: adminId,
            answers: [
                { value: "7%", is_correct: true },
                { value: "20%", is_correct: false },
                { value: "35%", is_correct: false },
                { value: "50%", is_correct: false },
            ],
        },
        {
            name: "Biện pháp nào sau đây giúp bảo tồn đa dạng sinh học TẠI CHỖ (in-situ)?",
            level: "NORMAL", priority: 4, created_by: adminId,
            answers: [
                { value: "Thành lập vườn quốc gia, khu bảo tồn thiên nhiên", is_correct: true },
                { value: "Nuôi động vật trong sở thú", is_correct: false },
                { value: "Lưu trữ hạt giống trong ngân hàng gen", is_correct: false },
                { value: "Nhân giống trong phòng thí nghiệm", is_correct: false },
            ],
        },
        {
            name: "Nguyên nhân chính dẫn đến sự tuyệt chủng của các loài là gì?",
            level: "EASY", priority: 5, created_by: adminId,
            answers: [
                { value: "Mất môi trường sống do con người phá hủy", is_correct: true },
                { value: "Biến đổi khí hậu tự nhiên", is_correct: false },
                { value: "Thiên tai như núi lửa, động đất", is_correct: false },
                { value: "Cạnh tranh giữa các loài trong tự nhiên", is_correct: false },
            ],
        },
        {
            name: "Hệ sinh thái nào được xem là cái nôi của đa dạng sinh học biển?",
            level: "NORMAL", priority: 6, created_by: adminId,
            answers: [
                { value: "Rạn san hô", is_correct: true },
                { value: "Biển sâu", is_correct: false },
                { value: "Vùng triều cát", is_correct: false },
                { value: "Hồ nước mặn", is_correct: false },
            ],
        },
        {
            name: "Công ước Đa dạng sinh học (CBD) được ký kết tại hội nghị nào?",
            level: "HARD", priority: 7, created_by: adminId,
            answers: [
                { value: "Hội nghị Thượng đỉnh Trái Đất Rio de Janeiro năm 1992", is_correct: true },
                { value: "Hội nghị Kyoto năm 1997", is_correct: false },
                { value: "Hội nghị Paris năm 2015", is_correct: false },
                { value: "Hội nghị Stockholm năm 1972", is_correct: false },
            ],
        },
        {
            name: "Việt Nam có bao nhiêu vườn quốc gia tính đến năm 2023?",
            level: "EASY", priority: 8, created_by: adminId,
            answers: [
                { value: "34", is_correct: true },
                { value: "20", is_correct: false },
                { value: "45", is_correct: false },
                { value: "10", is_correct: false },
            ],
        },
        {
            name: "Loài thực vật nào là biểu tượng của sự đa dạng sinh học tại Vườn Quốc gia Cúc Phương?",
            level: "NORMAL", priority: 9, created_by: adminId,
            answers: [
                { value: "Cây Chò chỉ nghìn năm tuổi", is_correct: true },
                { value: "Cây bạch đàn", is_correct: false },
                { value: "Cây xà cừ", is_correct: false },
                { value: "Cây keo lai", is_correct: false },
            ],
        },
        {
            name: "Chỉ thị sinh học (bioindicator) là gì?",
            level: "HARD", priority: 10, created_by: adminId,
            answers: [
                { value: "Sinh vật dùng để đánh giá chất lượng môi trường xung quanh", is_correct: true },
                { value: "Loài sinh vật có số lượng cá thể lớn nhất trong quần xã", is_correct: false },
                { value: "Loài sinh vật ngoại lai xâm hại", is_correct: false },
                { value: "Sinh vật được nhân giống vô tính trong phòng thí nghiệm", is_correct: false },
            ],
        },
    ];

    await QuestionBank.insertMany(questions);
    console.log(`✅ QuestionBank: đã tạo ${questions.length} câu hỏi mẫu`);
}

async function seedExam(adminId: mongoose.Types.ObjectId, questionIds: mongoose.Types.ObjectId[]) {
    const existing = await Exam.findOne({ name: "Kỳ thi thử - Đa dạng sinh học" });
    if (existing) { console.log("⏩ Exam: đã tồn tại, bỏ qua"); return; }

    const now = new Date();
    const endTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 ngày

    await Exam.create({
        name: "Kỳ thi thử - Đa dạng sinh học",
        description: "Kỳ thi thử về bảo tồn đa dạng sinh học",
        start_time: now,
        end_time: endTime,
        allowed_time: 20, // 20 phút
        template: {
            name: "Đề thi mẫu v1",
            questions: questionIds,
        },
        participants: [],
        created_by: adminId,
    });
    console.log("✅ Exam: đã tạo kỳ thi thử (20 phút, hết hạn sau 30 ngày)");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    try {
        await connectDB();

        await seedWebsiteConfig();
        const adminId = await seedUsers();
        await seedQuestionBank(adminId as mongoose.Types.ObjectId);

        const questions = await QuestionBank.find({ is_deleted: false }).select("_id").lean();
        const questionIds = questions.map((q) => q._id as mongoose.Types.ObjectId);
        await seedExam(adminId as mongoose.Types.ObjectId, questionIds);

        console.log("\n🎉 Seed hoàn tất!");
    } catch (err) {
        console.error("❌ Seed lỗi:", err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Disconnected");
    }
}

main();
