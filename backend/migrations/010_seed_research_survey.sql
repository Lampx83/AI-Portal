-- 010: Seed Khảo sát Hệ thống Hỗ trợ Nghiên cứu NEU-Research + bật routing Central.
-- CHỈ áp dụng cho instance Research (guard bằng sự tồn tại tool 'paperfinder'/'journal-conference').
-- Các instance khác (vd Tuyển sinh) sẽ NO-OP hoàn toàn.
-- Idempotent: reset survey theo slug rồi insert lại; app_settings chỉ set nếu chưa có.

DO $$
DECLARE
  sid uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ai_portal.tools WHERE alias IN ('paperfinder', 'journal-conference')
  ) THEN
    RAISE NOTICE '010_seed_research_survey: bỏ qua (không phải instance Research).';
    RETURN;
  END IF;

  -- Bật điều phối Central nếu chưa được cấu hình (không ghi đè admin đã set)
  INSERT INTO ai_portal.app_settings (key, value)
  VALUES ('central_routing_enabled', 'true')
  ON CONFLICT (key) DO NOTHING;

  -- Reset survey theo slug (idempotent)
  DELETE FROM ai_portal.surveys WHERE slug = 'neu-research-2026';

  INSERT INTO ai_portal.surveys
    (slug, name, description, is_active, priority, thank_you_message, display_config)
  VALUES (
    'neu-research-2026',
    'Khảo sát Hệ thống Hỗ trợ Nghiên cứu NEU-Research',
    'Cảm ơn bạn đã sử dụng Hệ thống Hỗ trợ Nghiên cứu Khoa học NEU-Research. Xin bạn dành ít phút trả lời một số câu hỏi để nhóm nghiên cứu (Đề tài trọng điểm NEU-2025TĐ.02) đánh giá và cải thiện hệ thống. Mọi thông tin được giữ kín và chỉ phục vụ mục đích nghiên cứu.',
    true,
    10,
    'Cảm ơn bạn đã hoàn thành khảo sát! Ý kiến của bạn giúp chúng tôi hoàn thiện hệ thống hỗ trợ nghiên cứu.',
    '{
      "audience": "all",
      "trigger": { "type": "after_seconds", "value": 10 },
      "position": "center",
      "frequency": { "type": "once_per_n_days", "value": 14 },
      "dismissible": true,
      "max_dismissals": 3,
      "cooldown_days_after_dismiss": 3,
      "pages_include": [],
      "pages_exclude": ["/admin", "/login", "/setup"]
    }'::jsonb
  )
  RETURNING id INTO sid;

  -- ===== Phần A: Thông tin & bối cảnh =====
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 0, 'single_choice', 'Bạn thuộc nhóm đối tượng nào?', NULL, true,
   '[{"id":"gv","label":"Giảng viên","allow_text":false},
     {"id":"ncs","label":"Nghiên cứu sinh","allow_text":false},
     {"id":"hvch","label":"Học viên cao học","allow_text":false},
     {"id":"sv","label":"Sinh viên","allow_text":false},
     {"id":"cbnc","label":"Cán bộ nghiên cứu","allow_text":false},
     {"id":"other","label":"Khác (vui lòng ghi rõ)","allow_text":true}]'::jsonb);

  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 1, 'single_choice', 'Bạn biết đến Hệ thống Hỗ trợ Nghiên cứu NEU-Research qua kênh nào?', 'Chọn kênh chính bạn tiếp cận đầu tiên.', true,
   '[{"id":"colleague","label":"Đồng nghiệp/giảng viên giới thiệu","allow_text":false},
     {"id":"email","label":"Email/thông báo của Trường","allow_text":false},
     {"id":"website","label":"Website/Fanpage của NEU","allow_text":false},
     {"id":"seminar","label":"Hội thảo/Tọa đàm khoa học","allow_text":false},
     {"id":"self","label":"Tự tìm hiểu","allow_text":false},
     {"id":"other","label":"Khác (vui lòng ghi rõ)","allow_text":true}]'::jsonb);

  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 2, 'single_choice', 'Tần suất bạn thực hiện hoạt động nghiên cứu khoa học?', 'Viết bài, phân tích dữ liệu, tổng quan tài liệu…', true,
   '[{"id":"daily","label":"Hằng ngày","allow_text":false},
     {"id":"weekly","label":"Hằng tuần","allow_text":false},
     {"id":"monthly","label":"Hằng tháng","allow_text":false},
     {"id":"sometimes","label":"Thỉnh thoảng","allow_text":false},
     {"id":"rarely","label":"Hiếm khi","allow_text":false}]'::jsonb);

  -- ===== Phần B: Nhu cầu & mức độ sử dụng =====
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 3, 'multi_choice', 'Bạn quan tâm hoặc sử dụng phân hệ nào nhất?', 'Chọn tất cả phân hệ bạn đã dùng hoặc quan tâm.', true,
   '[{"id":"paperfinder","label":"PaperFinder — Tra cứu bài báo","allow_text":false},
     {"id":"bibliomap","label":"BiblioMap — Trắc lượng thư mục","allow_text":false},
     {"id":"expertfinder","label":"ExpertFinder — Tìm chuyên gia","allow_text":false},
     {"id":"journal","label":"JournalConference — Gợi ý tạp chí/hội thảo","allow_text":false},
     {"id":"paperreviewer","label":"PaperReviewer — Phản biện bài báo","allow_text":false},
     {"id":"writium","label":"Writium — Soạn thảo nghiên cứu","allow_text":false},
     {"id":"surveylab","label":"Surveylab — Thiết kế khảo sát","allow_text":false},
     {"id":"quantis","label":"Quantis — Phân tích định lượng","allow_text":false},
     {"id":"annota","label":"Annota — Phân tích định tính","allow_text":false},
     {"id":"plagiarism","label":"PlagiarismChecker — Kiểm tra đạo văn","allow_text":false},
     {"id":"regulations","label":"Regulations — Quy trình/biểu mẫu","allow_text":false},
     {"id":"funds","label":"Funds — Tra cứu quỹ tài trợ","allow_text":false}]'::jsonb);

  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 4, 'single_choice', 'Khâu nào trong nghiên cứu bạn cần hỗ trợ nhất?', NULL, true,
   '[{"id":"gap","label":"Xác định khoảng trống/câu hỏi nghiên cứu","allow_text":false},
     {"id":"review","label":"Tổng quan tài liệu","allow_text":false},
     {"id":"collect","label":"Thiết kế khảo sát/thu thập dữ liệu","allow_text":false},
     {"id":"analyze","label":"Phân tích dữ liệu","allow_text":false},
     {"id":"write","label":"Viết bài & trích dẫn","allow_text":false},
     {"id":"publish","label":"Chọn nơi công bố","allow_text":false},
     {"id":"review2","label":"Phản biện/đánh giá kết quả","allow_text":false}]'::jsonb);

  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 5, 'single_choice', 'Trước khi có hệ thống, bạn thường thực hiện các tác vụ này bằng cách nào?', NULL, false,
   '[{"id":"manual","label":"Thủ công, tìm kiếm rời rạc","allow_text":false},
     {"id":"paid","label":"Công cụ nước ngoài trả phí","allow_text":false},
     {"id":"ask","label":"Nhờ đồng nghiệp hỗ trợ","allow_text":false},
     {"id":"none","label":"Chưa có cách hiệu quả","allow_text":false}]'::jsonb);

  -- ===== Phần C: Đánh giá trải nghiệm (Likert 5 mức — khung TAM) =====
  -- Thang chung dùng lại cho các câu Likert
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 6, 'single_choice', 'Hệ thống giúp tôi thực hiện công việc nghiên cứu nhanh hơn. (Tính hữu ích)', 'Mức độ đồng ý.', true,
   '[{"id":"1","label":"1 — Rất không đồng ý","allow_text":false},{"id":"2","label":"2 — Không đồng ý","allow_text":false},{"id":"3","label":"3 — Bình thường","allow_text":false},{"id":"4","label":"4 — Đồng ý","allow_text":false},{"id":"5","label":"5 — Rất đồng ý","allow_text":false}]'::jsonb),
  (sid, 7, 'single_choice', 'Hệ thống nâng cao chất lượng kết quả nghiên cứu của tôi. (Tính hữu ích)', NULL, true,
   '[{"id":"1","label":"1 — Rất không đồng ý","allow_text":false},{"id":"2","label":"2 — Không đồng ý","allow_text":false},{"id":"3","label":"3 — Bình thường","allow_text":false},{"id":"4","label":"4 — Đồng ý","allow_text":false},{"id":"5","label":"5 — Rất đồng ý","allow_text":false}]'::jsonb),
  (sid, 8, 'single_choice', 'Giao diện hệ thống dễ hiểu, dễ thao tác. (Tính dễ sử dụng)', NULL, true,
   '[{"id":"1","label":"1 — Rất không đồng ý","allow_text":false},{"id":"2","label":"2 — Không đồng ý","allow_text":false},{"id":"3","label":"3 — Bình thường","allow_text":false},{"id":"4","label":"4 — Đồng ý","allow_text":false},{"id":"5","label":"5 — Rất đồng ý","allow_text":false}]'::jsonb),
  (sid, 9, 'single_choice', 'Tôi nhanh chóng thành thạo cách dùng các phân hệ. (Tính dễ sử dụng)', NULL, true,
   '[{"id":"1","label":"1 — Rất không đồng ý","allow_text":false},{"id":"2","label":"2 — Không đồng ý","allow_text":false},{"id":"3","label":"3 — Bình thường","allow_text":false},{"id":"4","label":"4 — Đồng ý","allow_text":false},{"id":"5","label":"5 — Rất đồng ý","allow_text":false}]'::jsonb),
  (sid, 10, 'single_choice', 'Tôi thấy hứng thú khi sử dụng hệ thống cho công việc nghiên cứu. (Thái độ)', NULL, true,
   '[{"id":"1","label":"1 — Rất không đồng ý","allow_text":false},{"id":"2","label":"2 — Không đồng ý","allow_text":false},{"id":"3","label":"3 — Bình thường","allow_text":false},{"id":"4","label":"4 — Đồng ý","allow_text":false},{"id":"5","label":"5 — Rất đồng ý","allow_text":false}]'::jsonb),
  (sid, 11, 'single_choice', 'Tôi dự định tiếp tục sử dụng hệ thống trong các nghiên cứu tới. (Ý định sử dụng)', NULL, true,
   '[{"id":"1","label":"1 — Rất không đồng ý","allow_text":false},{"id":"2","label":"2 — Không đồng ý","allow_text":false},{"id":"3","label":"3 — Bình thường","allow_text":false},{"id":"4","label":"4 — Đồng ý","allow_text":false},{"id":"5","label":"5 — Rất đồng ý","allow_text":false}]'::jsonb);

  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 12, 'single_choice', 'Đánh giá MỨC ĐỘ HÀI LÒNG TỔNG THỂ của bạn về hệ thống NEU-Research?', NULL, true,
   '[{"id":"1","label":"Rất không hài lòng","allow_text":false},{"id":"2","label":"Không hài lòng","allow_text":false},{"id":"3","label":"Bình thường","allow_text":false},{"id":"4","label":"Hài lòng","allow_text":false},{"id":"5","label":"Rất hài lòng","allow_text":false}]'::jsonb),
  (sid, 13, 'single_choice', 'Mức độ hài lòng về Trợ lý AI trung tâm (Central) khi hỏi–đáp và điều hướng?', NULL, true,
   '[{"id":"1","label":"Rất không hài lòng","allow_text":false},{"id":"2","label":"Không hài lòng","allow_text":false},{"id":"3","label":"Bình thường","allow_text":false},{"id":"4","label":"Hài lòng","allow_text":false},{"id":"5","label":"Rất hài lòng","allow_text":false},{"id":"na","label":"Tôi chưa sử dụng","allow_text":false}]'::jsonb),
  (sid, 14, 'single_choice', 'Mức độ hài lòng về độ đầy đủ, chính xác của dữ liệu (tạp chí, chuyên gia, quỹ…)?', NULL, true,
   '[{"id":"1","label":"Rất không hài lòng","allow_text":false},{"id":"2","label":"Không hài lòng","allow_text":false},{"id":"3","label":"Bình thường","allow_text":false},{"id":"4","label":"Hài lòng","allow_text":false},{"id":"5","label":"Rất hài lòng","allow_text":false},{"id":"na","label":"Tôi chưa sử dụng","allow_text":false}]'::jsonb);

  -- ===== Phần D: NPS & góp ý mở =====
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 15, 'single_choice', 'Bạn có sẵn sàng GIỚI THIỆU hệ thống cho đồng nghiệp/học viên không?', NULL, true,
   '[{"id":"5","label":"Chắc chắn giới thiệu","allow_text":false},
     {"id":"4","label":"Có thể sẽ giới thiệu","allow_text":false},
     {"id":"3","label":"Trung lập","allow_text":false},
     {"id":"2","label":"Có thể không","allow_text":false},
     {"id":"1","label":"Chắc chắn không","allow_text":false}]'::jsonb);

  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 16, 'text', 'Tính năng hoặc dữ liệu nào bạn mong hệ thống bổ sung?', 'Không bắt buộc.', false, '[]'::jsonb),
  (sid, 17, 'text', 'Theo bạn, NEU-Research nên cải thiện điểm nào?', 'Không bắt buộc.', false, '[]'::jsonb);

  RAISE NOTICE '010_seed_research_survey: đã seed survey neu-research-2026 (18 câu) cho instance Research.';
END $$;
