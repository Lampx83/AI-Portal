# Bảng đối chiếu tính năng Editor (Trợ lý nghiên cứu)

Đối chiếu danh sách tính năng mong muốn với hiện trạng editor trong `MainAssistantView` và các module liên quan.

**Chú thích:** ✅ Có | ⚠️ Một phần | ❌ Chưa có

---

## I. Soạn thảo và cấu trúc học thuật

| Tính năng | Trạng thái | Ghi chú |
|-----------|------------|---------|
| Template bài báo khoa học (IEEE, ACM, Springer, Elsevier…) | ✅ | Có template Luận văn, Bài báo, Báo cáo, Đề cương, Hội nghị…; đã thêm mẫu nhanh Bài báo (IEEE), (ACM), (Springer), (Elsevier) trong menu Thêm |
| Hệ thống heading phân cấp (section, subsection…) | ✅ | h1, h2, h3 với Style dropdown |
| Equation editor (LaTeX / MathML) | ✅ | KaTeX, menu Công thức (LaTeX), inline |
| Viết công thức toán học inline và block | ✅ | Inline và block (display mode) trong menu Công thức |
| Chèn bảng biểu và quản lý caption | ⚠️ | Chèn bảng có; caption chưa tự động |
| Chèn hình ảnh và đánh số tự động | ⚠️ | Chèn ảnh, resize có; đánh số Figure chưa |
| Cross-reference (Figure/Table/Equation/Section) | ❌ | Chưa |
| Footnote và endnote | ❌ | Chưa |
| Outline view (dàn ý cấu trúc bài) | ✅ | Panel Dàn ý, click scroll tới heading |
| Focus mode / distraction-free writing | ✅ | Nút Chế độ tập trung (Focus): ẩn dàn ý, nút "Thoát chế độ tập trung" khi bật |
| Tự động đánh số mục | ❌ | Chưa (1, 1.1, 1.2…) |
| Style paragraph học thuật | ✅ | Normal, Tiêu đề 1–3 |
| Kiểm soát typography học thuật | ⚠️ | Font, cỡ chữ, căn lề |
| Hỗ trợ viết LaTeX trực tiếp hoặc hybrid editor | ⚠️ | Export LaTeX, công thức LaTeX trong editor |
| Version history và rollback | ✅ | Lịch sử phiên bản, khôi phục |

---

## II. Quản lý tài liệu tham khảo và trích dẫn

| Tính năng | Trạng thái | Ghi chú |
|-----------|------------|---------|
| Import DOI tự động | ❌ | Có trường DOI thủ công; chưa fetch metadata từ DOI |
| Import BibTeX / RIS / EndNote XML | ✅ | Dán chuỗi hoặc tải file, nhận dạng format |
| Tìm kiếm tài liệu từ CrossRef / PubMed / Google Scholar | ❌ | Chưa |
| Sinh citation inline | ✅ | Chèn trích dẫn (APA, IEEE) vào văn bản |
| Tạo reference list tự động | ✅ | Nút "Chèn danh sách tài liệu tham khảo" |
| Đổi citation style (APA, IEEE, Vancouver…) | ⚠️ | APA, IEEE; chưa Vancouver |
| Citation autocomplete | ❌ | Chưa |
| Phát hiện citation thiếu | ❌ | Chưa |
| Liên kết với reference manager (Zotero, Mendeley…) | ❌ | Chưa |
| Kiểm tra trùng citation | ❌ | Chưa |
| Citation preview | ⚠️ | Hiển thị trong menu trích dẫn |

---

## III. Collaboration và làm việc nhóm

| Tính năng | Trạng thái | Ghi chú |
|-----------|------------|---------|
| Real-time collaborative editing | ❌ | Chưa |
| Comment inline | ✅ | Bình luận gắn vùng chọn, popover |
| Suggestion mode / track changes | ❌ | Chưa |
| So sánh phiên bản tài liệu | ⚠️ | Có danh sách phiên bản; chưa diff viewer |
| Phân quyền tác giả (owner, co-author, reviewer) | ❌ | Chỉ share link chỉnh sửa |
| Mention (@user) trong tài liệu | ❌ | Chưa |
| Discussion thread | ✅ | Trả lời bình luận (reply) |
| Chấp nhận/từ chối chỉnh sửa | ❌ | Chưa |
| Notification thay đổi | ❌ | Chưa |
| Offline editing và sync | ⚠️ | Draft lưu localStorage; sync khi có mạng |

---

## IV. Kiểm tra chất lượng học thuật

| Tính năng | Trạng thái | Ghi chú |
|-----------|------------|---------|
| Grammar checking theo academic style | ❌ | Chưa |
| Style consistency checking | ❌ | Chưa |
| Plagiarism / similarity detection | ❌ | Chưa |
| Kiểm tra tính nhất quán thuật ngữ | ❌ | Chưa |
| Phát hiện câu quá dài hoặc khó hiểu | ❌ | Chưa |
| Phân tích readability | ❌ | Chưa |
| Kiểm tra cấu trúc IMRaD | ❌ | Chưa |
| Phát hiện thiếu reference | ❌ | Chưa |
| Kiểm tra lỗi citation format | ❌ | Chưa |
| Phân tích tone học thuật | ❌ | Chưa |

---

## V. Định dạng và xuất bản (Publishing workflow)

| Tính năng | Trạng thái | Ghi chú |
|-----------|------------|---------|
| Journal-specific formatting | ❌ | Chưa |
| One-click reformat theo guideline tạp chí | ❌ | Chưa |
| Kiểm tra lỗi layout trước submission | ❌ | Chưa |
| Export PDF chuẩn publisher | ⚠️ | Export PDF (html2pdf) |
| Export Word (.docx) | ✅ | API export-docx |
| Export LaTeX source | ✅ | Xuất .tex |
| Export HTML / Markdown | ✅ | HTML, Markdown |
| Metadata editor (author, affiliation, ORCID…) | ❌ | Chưa |
| Cover letter template | ❌ | Chưa |
| Submission checklist | ❌ | Chưa |

---

## VI. Hỗ trợ nghiên cứu và tri thức

| Tính năng | Trạng thái | Ghi chú |
|-----------|------------|---------|
| Literature search ngay trong editor | ❌ | Chưa |
| Gợi ý bài báo liên quan | ❌ | Chưa |
| Annotation PDF tài liệu tham khảo | ❌ | Chưa |
| Highlight và note trực tiếp trên paper | ❌ | Chưa |
| Knowledge graph giữa các citation | ❌ | Chưa |
| Summarize paper | ❌ | Chưa |
| Keyword extraction | ❌ | Chưa |
| Concept linking | ❌ | Chưa |
| Quản lý thư viện tài liệu cá nhân | ⚠️ | Danh sách references trong bài; chưa thư viện toàn hệ thống |

---

## VII. AI Assistant

| Tính năng | Trạng thái | Ghi chú |
|-----------|------------|---------|
| Gợi ý rewrite theo academic tone | ✅ | Inline edit với prompt "Phong cách học thuật" |
| Tạo outline bài báo | ✅ | Gợi ý tạo bài (Đề cương, Báo cáo tiến độ, Bài báo…) |
| Gợi ý tiêu đề | ❌ | Chưa |
| Tóm tắt abstract tự động | ❌ | Chưa |
| Gợi ý câu chuyển đoạn (transition) | ❌ | Chưa |
| Kiểm tra coherence logic | ❌ | Chưa |
| Phát hiện đoạn lặp ý | ❌ | Chưa |
| Gợi ý citation còn thiếu | ❌ | Chưa |
| Dịch thuật học thuật đa ngôn ngữ | ❌ | Chưa |
| Sinh caption cho hình/bảng | ❌ | Chưa |

---

## VIII. Tính năng nâng cao

| Tính năng | Trạng thái | Ghi chú |
|-----------|------------|---------|
| Version control kiểu Git | ⚠️ | Version history + restore |
| Plugin architecture | ❌ | Chưa |
| API tích hợp bên ngoài | ❌ | Chưa |
| Gắn dataset kèm bài báo | ❌ | Chưa |
| Embed code notebook (Python/R) | ❌ | Chưa |
| Interactive figure | ❌ | Chưa |
| Reproducible research workflow | ❌ | Chưa |
| Build pipeline tự động (compile PDF) | ❌ | Chưa |
| Continuous export | ❌ | Chưa |
| Diff viewer giữa hai phiên bản | ❌ | Chưa |
| Document analytics (word count, citation count…) | ⚠️ | Có số từ (word count) |

---

## IX. Trải nghiệm người dùng và hệ thống

| Tính năng | Trạng thái | Ghi chú |
|-----------|------------|---------|
| Dark mode / light mode | ✅ | Theme toggle (next-themes) |
| Keyboard shortcuts chuyên sâu | ⚠️ | Ctrl+S, Ctrl+Z/Y, Ctrl+B/I/U; chưa bảng phím tắt đầy đủ |
| Custom theme style | ❌ | Chưa |
| Auto-save thông minh | ✅ | Lưu tạm localStorage, sync theo chu kỳ khi có project |
| Cloud sync | ✅ | Lưu server theo project |
| Offline-first architecture | ⚠️ | Draft local |
| Search toàn bộ tài liệu | ✅ | Nút Tìm (Search): thanh tìm với Tìm tiếp / Tìm trước (window.find) |
| Global replace nâng cao | ❌ | Chưa |
| Navigation sidebar | ✅ | Dàn ý (outline), sidebar app |

---

## Các tính năng đã bổ sung trong đợt này

- **Focus mode**: Ẩn dàn ý, tối đa hóa vùng soạn thảo, nút thoát chế độ tập trung.
- **Công thức dạng block (display mode)**: Trong menu Công thức, thêm tùy chọn chèn công thức hiển thị giữa dòng (centered block).
- **Tìm trong bài (Find)**: Nút Tìm trên toolbar, mở thanh tìm kiếm, dùng `window.find()` hoặc tìm và nhảy tới kết quả.
- **Template IEEE/ACM/Springer/Elsevier**: Thêm nhãn hoặc mẫu nhanh tương ứng (cùng cấu trúc bài báo, khác tên).

File này sẽ được cập nhật khi có tính năng mới.
