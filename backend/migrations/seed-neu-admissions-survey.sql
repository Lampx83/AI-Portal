-- Seed: Phiếu khảo sát Tuyển sinh NEU 2026 (10 câu)
-- File này KHÔNG phải migration tự chạy (không có prefix số). Chạy thủ công bằng:
--   psql -U <user> -d <db> -f backend/migrations/seed-neu-admissions-survey.sql
-- Hoặc chạy lại để reset (idempotent: xoá theo slug rồi insert lại).

DO $$
DECLARE
  sid uuid;
BEGIN
  -- Reset nếu đã tồn tại theo slug
  DELETE FROM ai_portal.surveys WHERE slug = 'neu-admissions-2026';

  INSERT INTO ai_portal.surveys
    (slug, name, description, is_active, priority, thank_you_message, display_config)
  VALUES (
    'neu-admissions-2026',
    'Khảo sát hoạt động tuyển sinh NEU 2026',
    'Cảm ơn bạn đã quan tâm và có ý định ứng tuyển vào Đại học Kinh tế Quốc dân (NEU), và cảm ơn vì đã sử dụng hệ thống AI tuyển sinh. Xin bạn hãy dành ít phút để trả lời một số câu hỏi phỏng vấn giúp ĐH KTQD cải thiện hoạt động tuyển sinh. Mọi thông tin được giữ kín và chỉ phục vụ phân tích.',
    true,
    10,
    'Cảm ơn bạn đã hoàn thành khảo sát! Ý kiến của bạn rất quan trọng với chúng tôi.',
    '{
      "audience": "all",
      "trigger": { "type": "after_seconds", "value": 8 },
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

  -- Câu 1 — chọn nhiều
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 0, 'multi_choice',
   'Bạn biết đến hoạt động tuyển sinh của Đại học Kinh tế Quốc dân (NEU) qua kênh nào?',
   'Chọn tất cả các kênh bạn đã tiếp cận.',
   true,
   '[
     {"id": "website", "label": "Website chính thức của NEU", "allow_text": false},
     {"id": "fanpage", "label": "Fanpage/Mạng xã hội của NEU", "allow_text": false},
     {"id": "school_event", "label": "Ngày hội tư vấn tuyển sinh tại trường THPT", "allow_text": false},
     {"id": "friends_family", "label": "Người thân, bạn bè giới thiệu", "allow_text": false},
     {"id": "media", "label": "Báo chí, truyền hình", "allow_text": false},
     {"id": "search_engine", "label": "Google/Tìm kiếm trực tuyến", "allow_text": false},
     {"id": "other", "label": "Khác (vui lòng ghi rõ)", "allow_text": true}
   ]'::jsonb);

  -- Câu 2 — Phương thức xét tuyển NEU 2026
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 1, 'single_choice',
   'Phương thức xét tuyển nào bạn quan tâm nhất?',
   NULL,
   true,
   '[
     {"id": "thang", "label": "Xét tuyển thẳng / ưu tiên xét tuyển", "allow_text": false},
     {"id": "thpt", "label": "Xét theo điểm thi THPT (tổ hợp A00, A01, D01, D07)", "allow_text": false},
     {"id": "sat_act", "label": "Xét tuyển kết hợp – Nhóm SAT ≥ 1200 (mã 7793) / ACT ≥ 26 (mã 1767)", "allow_text": false},
     {"id": "hsa_tsa_vact", "label": "Xét tuyển kết hợp – Nhóm HSA ≥ 85/150, TSA ≥ 60/100, V-ACT ≥ 700/1200", "allow_text": false},
     {"id": "hsa_eng", "label": "Xét tuyển kết hợp – HSA/TSA/V-ACT + Tiếng Anh quốc tế (IELTS ≥ 5.5; TOEFL iBT ≥ 46; TOEIC 785/160/150)", "allow_text": false},
     {"id": "thpt_eng", "label": "Xét tuyển kết hợp – Điểm THPT + Tiếng Anh quốc tế (TA quy đổi + Toán + Văn/Lý/Hoá)", "allow_text": false},
     {"id": "international", "label": "Chương trình quốc tế / POHE / EBBA", "allow_text": false},
     {"id": "not_sure", "label": "Chưa rõ, cần tư vấn thêm", "allow_text": false}
   ]'::jsonb);

  -- Câu 3
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 2, 'single_choice',
   'Nhóm ngành nào tại NEU thu hút bạn nhất?',
   NULL,
   true,
   '[
     {"id": "business", "label": "Quản trị kinh doanh, Marketing, Logistics", "allow_text": false},
     {"id": "finance", "label": "Tài chính – Ngân hàng, Kế toán, Kiểm toán", "allow_text": false},
     {"id": "economics", "label": "Kinh tế học, Kinh tế quốc tế, Kinh tế phát triển", "allow_text": false},
     {"id": "it_math_stats", "label": "Toán kinh tế, Thống kê, Công nghệ thông tin, Khoa học dữ liệu, Hệ thống thông tin quản lý (MIS)", "allow_text": false},
     {"id": "law_pa", "label": "Luật, Quản lý công, Khoa học xã hội", "allow_text": false},
     {"id": "language", "label": "Ngôn ngữ Anh kinh tế, các chương trình quốc tế", "allow_text": false},
     {"id": "other", "label": "Ngành khác (vui lòng ghi rõ)", "allow_text": true}
   ]'::jsonb);

  -- Câu 4
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 3, 'single_choice',
   'Bạn đánh giá mức độ đầy đủ và rõ ràng của thông tin tuyển sinh trên website NEU như thế nào?',
   NULL,
   true,
   '[
     {"id": "5", "label": "Rất đầy đủ, dễ hiểu", "allow_text": false},
     {"id": "4", "label": "Khá đầy đủ", "allow_text": false},
     {"id": "3", "label": "Tạm ổn", "allow_text": false},
     {"id": "2", "label": "Còn thiếu thông tin", "allow_text": false},
     {"id": "1", "label": "Rất khó tìm/khó hiểu", "allow_text": false}
   ]'::jsonb);

  -- Câu 5 — chọn nhiều
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 4, 'multi_choice',
   'Bạn đã tham gia hoặc theo dõi hoạt động tư vấn tuyển sinh nào của NEU?',
   'Có thể chọn nhiều hoạt động.',
   true,
   '[
     {"id": "open_day", "label": "Ngày hội mở/Open Day tại NEU", "allow_text": false},
     {"id": "school_visit", "label": "Đoàn tư vấn tuyển sinh đến trường THPT", "allow_text": false},
     {"id": "online_livestream", "label": "Livestream/Webinar tư vấn online", "allow_text": false},
     {"id": "none", "label": "Chưa tham gia hoạt động nào", "allow_text": false},
     {"id": "other", "label": "Hoạt động khác (ghi rõ)", "allow_text": true}
   ]'::jsonb);

  -- Câu 6
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 5, 'single_choice',
   'Mức học phí có ảnh hưởng đến quyết định nộp hồ sơ vào NEU của bạn không?',
   NULL,
   true,
   '[
     {"id": "very_strong", "label": "Ảnh hưởng rất lớn", "allow_text": false},
     {"id": "strong", "label": "Ảnh hưởng đáng kể", "allow_text": false},
     {"id": "moderate", "label": "Ảnh hưởng vừa phải", "allow_text": false},
     {"id": "small", "label": "Ảnh hưởng ít", "allow_text": false},
     {"id": "none", "label": "Không ảnh hưởng", "allow_text": false}
   ]'::jsonb);

  -- Câu 7
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 6, 'single_choice',
   'Yếu tố nào quan trọng nhất khi bạn chọn ngành/chương trình tại NEU?',
   NULL,
   true,
   '[
     {"id": "career", "label": "Cơ hội việc làm sau tốt nghiệp", "allow_text": false},
     {"id": "passion", "label": "Phù hợp với sở thích, năng lực bản thân", "allow_text": false},
     {"id": "reputation", "label": "Uy tín ngành/khoa", "allow_text": false},
     {"id": "tuition", "label": "Học phí, học bổng, hỗ trợ tài chính", "allow_text": false},
     {"id": "international", "label": "Cơ hội học chương trình quốc tế/trao đổi", "allow_text": false},
     {"id": "family", "label": "Định hướng từ gia đình", "allow_text": false},
     {"id": "other", "label": "Yếu tố khác (ghi rõ)", "allow_text": true}
   ]'::jsonb);

  -- Câu 8 — Hài lòng tổng thể hoạt động tuyển sinh
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 7, 'single_choice',
   'Đánh giá MỨC ĐỘ HÀI LÒNG TỔNG THỂ của bạn về hoạt động tuyển sinh của NEU?',
   'Tổng hợp tất cả khâu: thông tin, tư vấn, thủ tục, hỗ trợ.',
   true,
   '[
     {"id": "5", "label": "Rất hài lòng", "allow_text": false},
     {"id": "4", "label": "Hài lòng", "allow_text": false},
     {"id": "3", "label": "Bình thường", "allow_text": false},
     {"id": "2", "label": "Chưa hài lòng", "allow_text": false},
     {"id": "1", "label": "Rất không hài lòng", "allow_text": false}
   ]'::jsonb);

  -- Câu 9 — Hài lòng về đội ngũ tư vấn
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 8, 'single_choice',
   'Mức độ hài lòng của bạn về THÁI ĐỘ và CHUYÊN MÔN của đội ngũ cán bộ/sinh viên tư vấn tuyển sinh NEU?',
   NULL,
   true,
   '[
     {"id": "5", "label": "Rất hài lòng – nhiệt tình, chuyên nghiệp", "allow_text": false},
     {"id": "4", "label": "Hài lòng", "allow_text": false},
     {"id": "3", "label": "Bình thường", "allow_text": false},
     {"id": "2", "label": "Chưa hài lòng – cần cải thiện", "allow_text": false},
     {"id": "1", "label": "Rất không hài lòng", "allow_text": false},
     {"id": "no_contact", "label": "Tôi chưa từng liên hệ tư vấn", "allow_text": false}
   ]'::jsonb);

  -- Câu 10 — Hài lòng về tốc độ phản hồi
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 9, 'single_choice',
   'Mức độ hài lòng về TỐC ĐỘ PHẢN HỒI khi bạn liên hệ tuyển sinh NEU (qua hotline, email, fanpage, chatbot)?',
   NULL,
   true,
   '[
     {"id": "5", "label": "Rất nhanh – phản hồi gần như tức thì", "allow_text": false},
     {"id": "4", "label": "Nhanh – trong vài giờ", "allow_text": false},
     {"id": "3", "label": "Trung bình – trong vòng 1 ngày", "allow_text": false},
     {"id": "2", "label": "Chậm – sau hơn 1 ngày", "allow_text": false},
     {"id": "1", "label": "Rất chậm hoặc không nhận được phản hồi", "allow_text": false},
     {"id": "no_contact", "label": "Tôi chưa liên hệ", "allow_text": false}
   ]'::jsonb);

  -- Câu 11 — Hài lòng về kênh thông tin
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 10, 'single_choice',
   'Mức độ hài lòng về CHẤT LƯỢNG VÀ ĐA DẠNG của các kênh thông tin tuyển sinh NEU (website, fanpage, video, hội thảo, hotline)?',
   NULL,
   true,
   '[
     {"id": "5", "label": "Rất hài lòng – đầy đủ và đa dạng", "allow_text": false},
     {"id": "4", "label": "Hài lòng", "allow_text": false},
     {"id": "3", "label": "Bình thường", "allow_text": false},
     {"id": "2", "label": "Chưa đa dạng/chưa cập nhật", "allow_text": false},
     {"id": "1", "label": "Rất nghèo nàn", "allow_text": false}
   ]'::jsonb);

  -- Câu 12 — Mức độ sẵn sàng giới thiệu (NPS-like)
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 11, 'single_choice',
   'Bạn có sẵn sàng GIỚI THIỆU người thân, bạn bè đăng ký tuyển sinh vào NEU không?',
   NULL,
   true,
   '[
     {"id": "definitely", "label": "Chắc chắn sẽ giới thiệu", "allow_text": false},
     {"id": "likely", "label": "Có thể sẽ giới thiệu", "allow_text": false},
     {"id": "neutral", "label": "Trung lập – tuỳ trường hợp", "allow_text": false},
     {"id": "unlikely", "label": "Có lẽ không", "allow_text": false},
     {"id": "no", "label": "Chắc chắn không", "allow_text": false}
   ]'::jsonb);

  -- Câu 13 — hài lòng hệ thống AI tuyển sinh
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 12, 'single_choice',
   'Bạn đánh giá mức độ hài lòng với Hệ thống AI tuyển sinh của NEU (chatbot/trợ lý AI) như thế nào?',
   'Đánh giá tổng thể về tốc độ, độ chính xác và tính hữu ích.',
   true,
   '[
     {"id": "5", "label": "Rất hài lòng", "allow_text": false},
     {"id": "4", "label": "Hài lòng", "allow_text": false},
     {"id": "3", "label": "Bình thường", "allow_text": false},
     {"id": "2", "label": "Chưa hài lòng", "allow_text": false},
     {"id": "1", "label": "Rất không hài lòng", "allow_text": false},
     {"id": "not_used", "label": "Tôi chưa sử dụng hệ thống AI tuyển sinh", "allow_text": false},
     {"id": "comment", "label": "Khác (vui lòng góp ý cụ thể)", "allow_text": true}
   ]'::jsonb);

  -- Câu 14 — text tự do (không bắt buộc)
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 13, 'text',
   'Bạn còn thắc mắc thông tin gì về tuyển sinh NEU mà chưa được giải đáp?',
   'Hãy chia sẻ cụ thể câu hỏi của bạn để bộ phận tuyển sinh hỗ trợ.',
   false,
   '[]'::jsonb);

  -- Câu 15 — text tự do (không bắt buộc)
  INSERT INTO ai_portal.survey_questions (survey_id, order_index, type, title, description, is_required, options) VALUES
  (sid, 14, 'text',
   'Theo bạn, NEU nên cải thiện hoạt động tuyển sinh ở điểm nào?',
   'Mọi đề xuất của bạn đều rất quý giá.',
   false,
   '[]'::jsonb);

  RAISE NOTICE 'Đã seed khảo sát "neu-admissions-2026" với id = %', sid;
END $$;
