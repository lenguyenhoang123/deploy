# Luồng Xử Lý Chứng Chỉ

## 1. Thiết Lập Chứng Chỉ (Admin)

### 1.1. Upload File (Logo, Background, Signatures)
```
POST /api/v1.0/file/upload
- Upload ảnh logo, background, chữ ký
- Lưu vào database (file collection)
- Lưu file vào /images/
- Trả về file ID (ObjectId)
```

### 1.2. Cấu Hình Template Chứng Chỉ
```
PUT /api/v1.0/exam/{exam_id}/certificate-template
Body:
{
  "name": "Chứng chỉ Bảo tồn thiên nhiên 2026",
  "is_enabled": true,
  "conditions": {
    "min_score": 50,
    "require_all_correct": false,
    "completion_required": true
  },
  "design": {
    "title": "CHỨNG CHỈ",
    "subtitle": "HOÀN THÀNH KỲ THI",
    "logo": "507f1f77bcf86cd799439011",      // ObjectId của file logo
    "background": "507f1f77bcf86cd799439012", // ObjectId của file background
    "primary_color": "#c9a227",
    "layout": {
      "font_family": "Times New Roman",
      "border_style": "double"
    },
    "content": {
      "show_exam_name": true,
      "show_score": true,
      "show_completion_date": true
    },
    "signatures": [
      {
        "name": "Nguyễn Văn A",
        "title": "Giám đốc",
        "position": "left",
        "signature_image": "507f1f77bcf86cd799439013" // ObjectId của file chữ ký
      },
      {
        "name": "Trần Thị B", 
        "title": "Chủ tịch",
        "position": "right",
        "signature_image": "507f1f77bcf86cd799439014"
      }
    ]
  },
  "legal_text": "Chứng chỉ này có giá trị xác nhận hoàn thành kỳ thi"
}
```

## 2. Thi Kỳ Thi (Thí Sinh)

### 2.1. Làm Bài Thi
```
POST /api/v1.0/exam/{exam_id}/start
- Bắt đầu kỳ thi
- Lưu participant record
```

### 2.2. Nộp Bài
```
POST /api/v1.0/exam-participant/{participant_id}/submit
- Tính điểm, lưu kết quả
- Đánh dấu submit_time
```

## 3. Phát Hành Chứng Chỉ

### 3.1. Finalize (Tự động hoặc thủ công)
```
POST /api/v1.0/exam-participant/{participant_id}/finalize
```

**Luồng xử lý:**

1. **Kiểm tra điều kiện:**
   ```javascript
   const meetsConditions = (
     score >= template.conditions.min_score &&
     (!template.conditions.require_all_correct || score === totalQuestions) &&
     (!template.conditions.completion_required || participant.submit_time)
   );
   ```

2. **Tạo Certificate Record:**
   ```javascript
   const certificate = {
     certificate_code: generateCertificateCode(), // "CERT-MOIBC7L1-KGT"
     participant_id: participant._id,
     exam_id: exam._id,
     template_id: template._id,
     score: score,
     issued_date: new Date(),
     notified: false
   };
   ```

3. **Generate PDF:**
   ```javascript
   // CertificatePdfService.generateCertificatePdf()
   const pdfPath = await certificatePdfService.generateCertificatePdf(
     certificate,
     template,
     absolutePdfPath
   );
   ```

4. **PDF Generation Process:**
   - Query file info từ database (logo, background, signatures)
   - Convert ảnh sang base64
   - Build HTML với CSS styling
   - Generate PDF bằng Puppeteer
   - Save PDF vào `/storage/certificates/`

5. **Update Certificate:**
   ```javascript
   certificate.file_url = relativePath; // "/certificates/certificate_CERT-MOIBC7L1-KGT_xxx.pdf"
   ```

6. **Send Email:**
   ```javascript
   await sendCertificateEmail(user, certificate, participant, score, totalQuestions, "new");
   ```

7. **Mark Notified:**
   ```javascript
   certificate.notified = true;
   certificate.notified_date = new Date();
   ```

### 3.2. Bulk Finalize (Admin)
```
POST /api/v1.0/exam/{exam_id}/bulk-finalize
- Process tất cả participants đã nộp bài
- Bỏ qua những người đã có chứng chỉ và đã notified
- Generate PDF và gửi email hàng loạt
```

## 4. Xem Chứng Chỉ

### 4.1. Direct PDF Access
```
GET /certificates/certificate_CERT-MOIBC7L1-KGT_xxx.pdf
- Static file serving từ Express
- Không cần authentication
```

### 4.2. Email Template
```
Subject: 🎉 Chúc mừng bạn đã đạt chứng chỉ!

Chào [user_full_name],

Chúc mừng bạn đã hoàn thành kỳ thi [exam_name] với số điểm [exam_score]/[total_questions].

Chứng chỉ của bạn: [certificate_link]
Link trực tiếp PDF: [pdf_link]

Mã chứng chỉ: [certificate_code]
Ngày cấp: [completion_date]
```

## 5. Cập Nhật Chứng Chỉ

### 5.1. Update Score (Re-finalize)
```
POST /api/v1.0/exam-participant/{participant_id}/finalize
- Nếu certificate đã tồn tại:
  - Regenerate PDF với điểm mới
  - Gửi email "updated"
  - Update certificate record
```

### 5.2. Revoke Certificate
```
POST /api/v1.0/exam-participant/{participant_id}/finalize
- Nếu không meets conditions:
  - Đánh dấu certificate là revoked
  - Gửi email "revoked"
```

## 6. Database Schema

### Certificate Template
```javascript
{
  _id: ObjectId,
  exam_id: ObjectId,
  name: String,
  is_enabled: Boolean,
  conditions: {
    min_score: Number,
    require_all_correct: Boolean,
    completion_required: Boolean
  },
  design: {
    title: String,
    subtitle: String,
    logo: ObjectId,        // File ID
    background: ObjectId, // File ID
    primary_color: String,
    layout: Object,
    content: Object,
    signatures: [{
      name: String,
      title: String,
      position: String,
      signature_image: ObjectId // File ID
    }]
  },
  legal_text: String
}
```

### Certificate
```javascript
{
  _id: ObjectId,
  certificate_code: String,
  participant_id: ObjectId,
  exam_id: ObjectId,
  template_id: ObjectId,
  score: Number,
  file_url: String,
  issued_date: Date,
  notified: Boolean,
  notified_date: Date,
  created_at: Date,
  updated_at: Date
}
```

## 7. File Management

### File Upload Flow
1. Upload file → `/images/` folder
2. Save to database `file` collection
3. Return ObjectId
4. Certificate template references ObjectId
5. PDF generation queries file info
6. Convert to base64 and embed in HTML

### File Structure
```
/storage/
├── certificates/
│   └── certificate_CERT-MOIBC7L1-KGT_xxx.pdf
/images/
├── 6f936c28-f01f-4c15-8fd8-d2000780a2bf.jpg  // Logo
├── 53738bad-6924-49fb-ad55-c8f169293c4b.png  // Background
└── signature_files.png                        // Signatures
```

## 8. Error Handling

### Common Issues
1. **File not found:** Check file_path vs actual location
2. **PDF generation failed:** Check Puppeteer permissions
3. **Email not sent:** Check SMTP configuration
4. **Template not found:** Check exam_id mapping

### Logging
- `[FINALIZE]` - Main process flow
- `[PDF]` - PDF generation details
- `[MAIL]` - Email sending status

## 9. Security Considerations

- PDF files publicly accessible via static serving
- Certificate codes unique and non-guessable
- Email templates use template variables (no XSS)
- File uploads validated for image types only
