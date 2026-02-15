#!/usr/bin/env node
/**
 * Tạo các file mẫu để test Agents: pdf, docx, xlsx, xls, txt, md
 * Nội dung về chủ đề: Machine Learning trong Y tế
 * Chạy: node scripts/generate-sample-files.mjs
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, "../sample-files")

// Nội dung thật về Machine Learning trong Y tế
const SAMPLE_CONTENT = {
  title: "Machine Learning trong Chẩn đoán Y tế",
  intro: `Ứng dụng Machine Learning (ML) và Trí tuệ Nhân tạo (AI) trong y tế đang trở thành xu hướng quan trọng. Các mô hình học sâu có thể hỗ trợ bác sĩ chẩn đoán bệnh từ hình ảnh X-quang, MRI, và phân tích dữ liệu lâm sàng với độ chính xác ngày càng cao.`,

  section1: `Các ứng dụng chính:
- Chẩn đoán hình ảnh: CNN (Convolutional Neural Network) phân tích ảnh X-quang, CT scan để phát hiện ung thư, tổn thương phổi.
- Dự đoán bệnh: Mô hình dự đoán nguy cơ tim mạch, tiểu đường dựa trên dữ liệu bệnh nhân.
- Xử lý ngôn ngữ tự nhiên: Trích xuất thông tin từ bệnh án điện tử, hỗ trợ đơn thuốc.`,

  section2: `Thách thức và hướng phát triển:
Dữ liệu y tế nhạy cảm đòi hỏi bảo mật cao. Federated Learning cho phép huấn luyện mô hình mà không cần chia sẻ dữ liệu gốc. Explainable AI giúp bác sĩ hiểu lý do mô hình đưa ra chẩn đoán, tăng độ tin cậy trong thực hành lâm sàng.`,

  conclusion: `Tài liệu này phục vụ mục đích test hệ thống AI Portal - kiểm tra khả năng đọc và phân tích nội dung của các Agent AI.`,
}

const FULL_TEXT = [
  SAMPLE_CONTENT.title,
  "",
  SAMPLE_CONTENT.intro,
  "",
  SAMPLE_CONTENT.section1,
  "",
  SAMPLE_CONTENT.section2,
  "",
  SAMPLE_CONTENT.conclusion,
].join("\n")

// PDF text - ASCII only
const PDF_TEXT = `Machine Learning in Medical Diagnosis

Applications of Machine Learning and AI in healthcare are becoming increasingly important. Deep learning models can assist doctors in diagnosing diseases from X-rays, MRI images, and clinical data analysis with improving accuracy.

Key applications: Medical imaging (CNN for X-ray, CT scan analysis), disease prediction (cardiovascular risk, diabetes), and NLP for electronic health records.

Challenges include data privacy - Federated Learning allows training without sharing raw data. Explainable AI helps doctors understand model reasoning for clinical trust.`

fs.mkdirSync(OUT_DIR, { recursive: true })

// TXT
fs.writeFileSync(path.join(OUT_DIR, "sample.txt"), FULL_TEXT, "utf-8")
console.log("✅ sample.txt")

// MD
const mdContent = `# ${SAMPLE_CONTENT.title}

## Giới thiệu

${SAMPLE_CONTENT.intro}

## Ứng dụng chính

${SAMPLE_CONTENT.section1}

## Thách thức và hướng phát triển

${SAMPLE_CONTENT.section2}

## Kết luận

${SAMPLE_CONTENT.conclusion}
`
fs.writeFileSync(path.join(OUT_DIR, "sample.md"), mdContent, "utf-8")
console.log("✅ sample.md")

// PDF - pdf-lib (ASCII only)
try {
  const { PDFDocument, rgb } = await import("pdf-lib")
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842])
  const lines = PDF_TEXT.split("\n")
  let y = 750
  const lineHeight = 14
  for (const line of lines) {
    if (line.startsWith("Key") || line.startsWith("Challenges")) {
      page.drawText(line, { x: 50, y, size: 10, color: rgb(0, 0, 0), maxWidth: 495 })
    } else {
      page.drawText(line, { x: 50, y, size: 12, color: rgb(0, 0, 0), maxWidth: 495 })
    }
    y -= lineHeight
  }
  const pdfBytes = await pdfDoc.save()
  fs.writeFileSync(path.join(OUT_DIR, "sample.pdf"), Buffer.from(pdfBytes))
  console.log("✅ sample.pdf")
} catch (e) {
  console.warn("⚠️ pdf-lib chưa cài, bỏ qua PDF:", e.message)
}

// DOCX
try {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx")
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: SAMPLE_CONTENT.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Giới thiệu", bold: true })],
          spacing: { after: 100 },
        }),
        new Paragraph({ children: [new TextRun(SAMPLE_CONTENT.intro)] }),
        new Paragraph({
          children: [new TextRun({ text: "Ứng dụng chính", bold: true })],
          spacing: { before: 200, after: 100 },
        }),
        new Paragraph({ children: [new TextRun(SAMPLE_CONTENT.section1)] }),
        new Paragraph({
          children: [new TextRun({ text: "Thách thức và hướng phát triển", bold: true })],
          spacing: { before: 200, after: 100 },
        }),
        new Paragraph({ children: [new TextRun(SAMPLE_CONTENT.section2)] }),
        new Paragraph({
          children: [new TextRun(SAMPLE_CONTENT.conclusion)],
          spacing: { before: 200 },
        }),
      ],
    }],
  })
  const buf = await Packer.toBuffer(doc)
  fs.writeFileSync(path.join(OUT_DIR, "sample.docx"), buf)
  console.log("✅ sample.docx")
} catch (e) {
  console.warn("⚠️ docx chưa cài, bỏ qua DOCX:", e.message)
}

// CSV - Dữ liệu bảng dạng text
const csvRows = [
  ["Ứng dụng ML", "Độ chính xác (%)", "Dữ liệu huấn luyện", "Ghi chú"],
  ["Chẩn đoán ung thư da", "91", "10.000 ảnh", "CNN, so sánh với bác sĩ da liễu"],
  ["Phát hiện bệnh võng mạc", "94", "128.000 ảnh fundus", "Google DeepMind - bệnh tiểu đường"],
  ["Phân tích X-quang phổi", "89", "112.000 ảnh ChestX-ray", "Phát hiện viêm phổi, nốt ung thư"],
  ["Dự đoán nhập viện", "85", "50.000 hồ sơ", "Mô hình dự đoán 30 ngày tái nhập viện"],
  ["Federated Learning", "N/A", "Đa bệnh viện", "Bảo mật dữ liệu, không chia sẻ raw data"],
]
const csvContent = csvRows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
fs.writeFileSync(path.join(OUT_DIR, "sample.csv"), "\uFEFF" + csvContent, "utf-8") // BOM for Excel
console.log("✅ sample.csv")

// XLSX, XLS - Bảng dữ liệu giả lập
try {
  const XLSX = await import("xlsx")
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ["Ứng dụng ML", "Độ chính xác (%)", "Dữ liệu huấn luyện", "Ghi chú"],
    ["Chẩn đoán ung thư da", 91, "10.000 ảnh", "CNN, so sánh với bác sĩ da liễu"],
    ["Phát hiện bệnh võng mạc", 94, "128.000 ảnh fundus", "Google DeepMind - bệnh tiểu đường"],
    ["Phân tích X-quang phổi", 89, "112.000 ảnh ChestX-ray", "Phát hiện viêm phổi, nốt ung thư"],
    ["Dự đoán nhập viện", 85, "50.000 hồ sơ", "Mô hình dự đoán 30 ngày tái nhập viện"],
    ["Federated Learning", "N/A", "Đa bệnh viện", "Bảo mật dữ liệu, không chia sẻ raw data"],
  ])
  XLSX.utils.book_append_sheet(wb, ws, "Tổng quan ứng dụng")
  const ws2 = XLSX.utils.aoa_to_sheet([
    ["Năm", "Số bài báo", "Lĩnh vực chính"],
    [2020, 1520, "Chẩn đoán hình ảnh"],
    [2021, 1890, "NLP trong bệnh án"],
    [2022, 2100, "Federated Learning"],
    [2023, 2450, "Large Language Models y tế"],
  ])
  XLSX.utils.book_append_sheet(wb, ws2, "Xu hướng")
  XLSX.writeFile(wb, path.join(OUT_DIR, "sample.xlsx"), { bookType: "xlsx" })
  XLSX.writeFile(wb, path.join(OUT_DIR, "sample.xls"), { bookType: "xls" })
  console.log("✅ sample.xlsx, sample.xls")
} catch (e) {
  console.warn("⚠️ xlsx chưa cài, bỏ qua Excel:", e.message)
}

console.log("✅ Đã tạo xong các file mẫu trong", OUT_DIR)
