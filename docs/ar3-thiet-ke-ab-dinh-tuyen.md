# AR-3: thiết kế A/B định tuyến mô hình (bài W25) — CHỈ THIẾT KẾ, CHƯA BẬT

Trạng thái: bản nháp để thầy duyệt. Không có mã nào trong tài liệu này được triển khai. Nền dữ liệu (cột `user_id`, `model_id_served`, `served_status`, `profile_injected`, `experiment_id`, `arm` trên `messages`) đã nằm trong migration 027 (AR-2); AR-3 chỉ cần thêm bảng cấu hình, gán nhánh và đồng ý.

## 1. Phạm vi
- Chỉ trợ lý `central` (nơi duy nhất máy chủ tự chọn model, xem `orchestrator.ts`: `centralModel = cred.model`). Trợ lý ngoài, khách (`GUEST_USER_ID`), embed: không tham gia.
- Đơn vị ngẫu nhiên hoá là **người dùng** (không phải tin nhắn, không phải phiên): gán một lần, giữ nguyên suốt thực nghiệm.

## 2. Dữ liệu (migration 028, sau khi AR-2 chạy ổn)
- `experiments(id TEXT PK, status draft|running|stopped, salt TEXT, arms JSONB, consent_scope TEXT, started_at, ended_at)`. `arms` = danh sách `{name, model_profile, weight}`; **không** chứa khoá API, chỉ trỏ tới hồ sơ model đã có trong `app_settings` (giống cấu hình Central hiện tại: provider, base URL, model, header).
- `experiment_assignments(experiment_id, user_id, arm, assigned_at, PK(experiment_id, user_id))`: đóng băng nhánh để đổi trọng số về sau không xáo người đã gán.
- `research_consents(user_id, scope, version, granted_at, withdrawn_at)`: consent riêng cho `ab_routing`. Banner ToS (AR-1) dùng cờ localStorage nên **không** đủ làm bằng chứng đồng ý (xem TOS-B).

## 3. Gán nhánh (phía máy chủ)
1. Điều kiện: thí nghiệm `running`, người dùng đã đăng nhập, có consent còn hiệu lực cho `consent_scope`, và `central`.
2. Nhánh = `HMAC(salt, user_id)` lấy 32 bit chia theo trọng số. Xác định (cùng người luôn cùng nhánh), không cần lưu trước; vẫn ghi `experiment_assignments` ở lượt đầu để cố định.
3. Không đủ điều kiện → đi đường mặc định hiện tại, `experiment_id`/`arm` để NULL (không lẫn vào phân tích).

## 4. Định tuyến và ghi nhận
- Trong `orchestrator.ts`, ngay sau `getCentralLlmCredentials()`: `resolveArm(userId)` có thể thay `cred` (model/baseUrl/header) bằng hồ sơ của nhánh. Mọi thứ phía sau giữ nguyên.
- `servedMeta` (đã có từ AR-2) bổ sung `experiment_id`, `arm`; `chat.ts` chuyển vào `appendMessage` (hai tham số đã có sẵn). Nhãn client `auto` luôn được thay bằng model thật vào `model_id_served`.
- Nhánh lỗi/không với tới được → quay về nhánh đối chứng, ghi `served_status='fallback'` nhưng **giữ nguyên `arm`** (phân tích theo ý định điều trị). Lỗi hẳn: `served_status='error'`.
- Công tắc khẩn: `experiments.status='stopped'` hoặc đặt `EXPERIMENTS_ENABLED=false` → mọi người về đường mặc định ngay, không cần deploy.

## 5. Chỉ số và cỡ mẫu
- Chỉ số chính cần chốt TRƯỚC khi bật (đăng ký sẵn): đề xuất tỉ lệ 👍/(👍+👎) trên tin nhắn assistant (đã có `message_feedback`), phụ: độ trễ `response_time_ms`, token, tỉ lệ hỏi lại/tái tạo, quay lại trong 7 ngày.
- Phân tích theo người dùng (trung bình mỗi người, hoặc mô hình hỗn hợp có hiệu ứng ngẫu nhiên theo người), không xem tin nhắn là độc lập.
- Kế hoạch cần ≥200 người mỗi nhánh có ≥3 phiên; hiện toàn hệ thống mới có ~160 người có ≥3 tin và đợt tăng đột biến tuần 12/10 chưa chắc lặp lại → **nguy cơ thiếu sức mạnh thống kê**. Nên tính power với tỉ lệ 👍 thực tế trước khi chạy; nếu thiếu, hạ thành nghiên cứu mô tả/thí điểm.

## 6. Những việc thầy phải quyết
1. Hai nhánh là gì (ví dụ gpt-4o-mini so với model nội bộ qwen3.5 qua vLLM) và trọng số.
2. Consent riêng cho A/B: lời văn, cơ chế rút lại, và có cho người dùng thấy/chọn model không (nếu cho chọn thì không còn là A/B).
3. Chỉ số chính.
4. Thời lượng và điều kiện dừng sớm (lỗi/độ trễ vượt ngưỡng).

## 7. Công sức và rủi ro
4–5 ngày sau khi AR-2 chạy ổn. Rủi ro: ghi nhận trùng ở đường streaming/send (đã có test tĩnh đếm 6 lệnh `appendMessage`); cỡ mẫu; consent chưa có. Không bật khi chưa có 3 mục của phần 6.
