/**
 * Hướng dẫn thực hiện dự án nghiên cứu theo 6 giai đoạn vòng đời (khớp backend/src/lib/project-lifecycle.ts).
 * Dữ liệu thuần: dùng cho giao diện (nạp checklist mẫu, hiển thị hướng dẫn) và để sinh tài liệu Markdown
 * (scripts/stage-guide-to-md.mjs). Tiêu đề bước ≤ 80 ký tự để dùng thẳng làm mục checklist.
 */

export interface StageGuideStep {
  title: string
  detail: string
  output?: string
  toolAlias?: string
  who?: string
}

export interface StageGuide {
  id: "explore" | "review" | "design" | "analyze" | "write" | "publish"
  goal: string
  duration: string
  steps: StageGuideStep[]
  outputs: string[]
  doneWhen: string[]
  mistakes: string[]
  teamTips: string[]
}

export const STAGE_GUIDES: Record<StageGuide["id"], StageGuide> = {
  explore: {
    id: "explore",
    goal:
      "Biến một ý tưởng mơ hồ thành đề tài đủ rõ để làm: có câu hỏi nghiên cứu sơ bộ, biết ai đang làm gì trong lĩnh vực, thấy được khoảng trống và chốt nhóm làm việc cùng mốc thời gian.",
    duration: "1–2 tuần",
    steps: [
      {
        title: "Chốt chủ đề và câu hỏi nghiên cứu sơ bộ",
        detail:
          "Cả nhóm ghi ra 2–3 chủ đề, mỗi chủ đề kèm một câu hỏi dạng «X ảnh hưởng thế nào đến Y ở đối tượng Z?». Chọn chủ đề có dữ liệu tiếp cận được trong thời gian của nhóm. Ghi câu hỏi vào phần mô tả dự án.",
        output: "Câu hỏi nghiên cứu sơ bộ (1–2 câu) trong mô tả dự án",
        who: "Cả nhóm, trưởng nhóm chốt",
      },
      {
        title: "Tìm 3–5 chuyên gia hoặc nhóm nghiên cứu liên quan",
        detail:
          "Dùng công cụ Tìm kiếm chuyên gia với từ khoá chủ đề (tiếng Anh và tiếng Việt). Ghi tên, đơn vị, hướng nghiên cứu, 2–3 công bố gần nhất. Ưu tiên người trong và ngoài Đại học Kinh tế Quốc dân có thể góp ý.",
        output: "Bảng 3–5 chuyên gia/nhóm (tên, đơn vị, hướng nghiên cứu, bài tiêu biểu)",
        toolAlias: "expertfinder",
        who: "1 thành viên",
      },
      {
        title: "Đọc 5–10 bài nền của lĩnh vực",
        detail:
          "Chọn các bài được trích dẫn nhiều hoặc bài tổng quan gần đây (≤ 5 năm). Mỗi người đọc 2–3 bài, ghi ra: câu hỏi, phương pháp, kết quả chính, hạn chế. Chưa cần tìm đủ tài liệu — việc đó ở giai đoạn Tổng quan.",
        output: "Phiếu đọc ngắn (mỗi bài 5–6 dòng) tải lên thư mục Tài liệu/Tìm hiểu",
        toolAlias: "paperfinder",
        who: "Chia đều cho các thành viên",
      },
      {
        title: "Xác định khoảng trống nghiên cứu",
        detail:
          "Từ các phiếu đọc, tìm điểm các bài còn thiếu: chưa nghiên cứu ở Việt Nam, chưa xét biến X, mẫu nhỏ, kết quả mâu thuẫn. Viết 2–3 câu nêu khoảng trống và vì sao nó quan trọng.",
        output: "Đoạn «khoảng trống nghiên cứu» 2–3 câu",
        who: "Trưởng nhóm tổng hợp, cả nhóm góp ý",
      },
      {
        title: "Viết đề cương 1 trang",
        detail:
          "Một trang gồm: tên đề tài dự kiến, bối cảnh, khoảng trống, câu hỏi và mục tiêu nghiên cứu, đối tượng/dữ liệu dự kiến, phương pháp dự kiến, kết quả mong đợi. Gửi giảng viên hướng dẫn (vai Xem) để xin ý kiến.",
        output: "De-cuong_1-trang.docx (bản v01)",
        toolAlias: "writium",
        who: "1 người viết, cả nhóm đọc",
      },
      {
        title: "Chốt phân công và mốc thời gian 6 giai đoạn",
        detail:
          "Ghi người phụ trách chính cho từng giai đoạn, đặt ngày dự kiến hoàn thành mỗi giai đoạn trên bảng vòng đời, thống nhất ngày họp nhóm cố định hằng tuần.",
        output: "Hạn từng giai đoạn trên vòng đời + lịch họp tuần",
        who: "Trưởng nhóm",
      },
    ],
    outputs: [
      "Đề cương 1 trang đã có ý kiến của giảng viên",
      "Bảng chuyên gia/nhóm nghiên cứu liên quan",
      "Phiếu đọc 5–10 bài nền",
      "Bảng phân công và mốc thời gian",
    ],
    doneWhen: [
      "Câu hỏi nghiên cứu đã viết thành câu hoàn chỉnh và cả nhóm cùng đồng ý",
      "Khoảng trống nghiên cứu nêu được bằng 2–3 câu, có dẫn ít nhất 3 bài",
      "Giảng viên hướng dẫn đã đọc đề cương và không yêu cầu đổi hướng",
      "Mỗi giai đoạn sau đều có người phụ trách và ngày dự kiến",
    ],
    mistakes: [
      "Chọn đề tài quá rộng («tác động của AI đến giáo dục») nên không thu hẹp được thành câu hỏi kiểm chứng được",
      "Chọn đề tài mà chưa kiểm tra có tiếp cận được dữ liệu hay không",
      "Đọc quá nhiều bài tản mạn mà không ghi lại kết luận, đến sau quên bài nào nói gì",
      "Nhầm «chủ đề» (lĩnh vực) với «câu hỏi nghiên cứu» (điều cần trả lời)",
      "Không hỏi ý kiến giảng viên sớm, đến giai đoạn viết mới phải đổi hướng",
    ],
    teamTips: [
      "Họp khởi động 60 phút, mỗi người trình bày ý tưởng trong 3 phút trước khi thảo luận chung",
      "Chọn một người làm thư ký nhóm để ghi quyết định vào phần ghi chú giai đoạn",
      "Giữ mọi phiếu đọc ở một thư mục chung, đặt tên theo tên tác giả + năm",
      "Mời giảng viên vào dự án với vai Xem ngay từ đầu để góp ý trên cùng tài liệu",
    ],
  },

  review: {
    id: "review",
    goal:
      "Nắm toàn cảnh tài liệu về đề tài một cách có hệ thống, đủ để chứng minh khoảng trống, chọn khung lý thuyết và đặt giả thuyết/câu hỏi nghiên cứu chính thức.",
    duration: "2–4 tuần",
    steps: [
      {
        title: "Thiết kế chiến lược tìm kiếm tài liệu",
        detail:
          "Lập danh sách từ khoá chính, từ đồng nghĩa và cụm tiếng Việt; chọn cơ sở dữ liệu (Scopus, Web of Science, Google Scholar, tạp chí trong nước); đặt tiêu chí chọn/loại (năm xuất bản, ngôn ngữ, loại bài, bối cảnh). Ghi lại chuỗi tìm kiếm đã dùng và ngày tìm.",
        output: "Bảng chiến lược tìm kiếm (từ khoá, CSDL, tiêu chí chọn/loại, ngày)",
        who: "Trưởng nhóm + 1 người",
      },
      {
        title: "Tìm và thu thập bài báo theo chiến lược",
        detail:
          "Dùng công cụ Tra cứu bài báo để tìm theo từ khoá, xuất danh sách kết quả. Mỗi người phụ trách một cơ sở dữ liệu hoặc một nhóm từ khoá để tránh trùng, gộp lại và xoá bản trùng.",
        output: "Danh sách tổng hợp bài báo đã xoá trùng (tệp Excel/CSV)",
        toolAlias: "paperfinder",
        who: "Chia theo CSDL/từ khoá",
      },
      {
        title: "Sàng lọc theo tiêu đề, tóm tắt, toàn văn",
        detail:
          "Lọc 2 vòng theo kiểu PRISMA: vòng 1 theo tiêu đề và tóm tắt, vòng 2 đọc toàn văn. Mỗi bài bị loại ghi một lý do ngắn. Với bài còn tranh cãi, hai người cùng đọc rồi thống nhất.",
        output: "Sơ đồ lọc (số bài tìm được → còn lại → loại, kèm lý do)",
        who: "Hai người đọc độc lập, trưởng nhóm phân xử",
      },
      {
        title: "Lập bảng tổng hợp tài liệu",
        detail:
          "Mỗi bài một dòng: tác giả/năm, bối cảnh, mẫu, phương pháp, biến chính, kết quả, hạn chế. Bảng này là nguyên liệu viết mục Tổng quan và chọn thang đo ở giai đoạn sau.",
        output: "Bang-tong-hop-tai-lieu.xlsx",
        who: "Mỗi người điền phần bài mình đọc",
      },
      {
        title: "Phân tích bản đồ thư mục và xu hướng",
        detail:
          "Chạy công cụ Trắc lượng thư mục trên danh sách bài để xem từ khoá nổi bật, tác giả/tạp chí hay gặp, cụm chủ đề và xu hướng theo năm. Dùng kết quả để kiểm tra mình có bỏ sót nhánh nào không.",
        output: "Ảnh/bảng bản đồ từ khoá, tác giả, tạp chí chủ đạo",
        toolAlias: "bibliomap",
        who: "1 người rành công cụ",
      },
      {
        title: "Chọn khung lý thuyết và đặt giả thuyết/câu hỏi",
        detail:
          "Chọn 1–2 lý thuyết nền (vd TAM, UTAUT, lý thuyết tự quyết) có trong các bài mạnh nhất. Nêu giả thuyết hoặc câu hỏi chính thức, mỗi cái kèm lập luận dựa vào 2–3 bài trong bảng tổng hợp.",
        output: "Mô hình khái niệm dạng sơ đồ + danh sách giả thuyết có dẫn nguồn",
        who: "Cả nhóm thảo luận, trưởng nhóm viết",
      },
      {
        title: "Viết bản nháp mục Tổng quan tài liệu",
        detail:
          "Viết theo chủ đề, không liệt kê từng bài. Mỗi đoạn một ý: nhóm bài nói gì, khác nhau ở đâu, khoảng trống còn lại. Kết thúc bằng đoạn dẫn tới giả thuyết.",
        output: "Tong-quan_v01.docx (khoảng 1.500–2.500 từ)",
        toolAlias: "writium",
        who: "1–2 người viết",
      },
    ],
    outputs: [
      "Bảng chiến lược tìm kiếm và sơ đồ lọc bài",
      "Bảng tổng hợp tài liệu",
      "Bản đồ thư mục (từ khoá, tác giả, tạp chí)",
      "Khung lý thuyết, mô hình khái niệm và danh sách giả thuyết",
      "Bản nháp mục Tổng quan tài liệu",
    ],
    doneWhen: [
      "Bất kỳ ai ngoài nhóm cũng lặp lại được cách tìm tài liệu từ bảng chiến lược",
      "Mọi bài trong danh sách cuối đều có dòng trong bảng tổng hợp",
      "Mỗi giả thuyết có ít nhất 2 bài làm cơ sở",
      "Giảng viên đã xem mô hình khái niệm và đồng ý với hướng",
    ],
    mistakes: [
      "Chỉ tìm trên Google Scholar bằng một cụm từ rồi dừng, bỏ sót nhánh từ khoá khác",
      "Không ghi lại tiêu chí loại bài nên không giải thích được vì sao chọn bài này mà không chọn bài kia",
      "Viết tổng quan kiểu «tác giả A nói…, tác giả B nói…» thay vì tổng hợp theo chủ đề",
      "Chỉ trích bài đồng thuận, bỏ qua bài có kết quả mâu thuẫn",
      "Trích dẫn qua bài khác (nguồn thứ cấp) mà chưa đọc bài gốc",
      "Chọn quá nhiều lý thuyết nền nên mô hình rối, không kiểm định nổi",
    ],
    teamTips: [
      "Chia bài đọc theo cơ sở dữ liệu hoặc nhóm từ khoá, chốt hạn nộp phiếu đọc mỗi tuần",
      "Dùng đúng một công cụ quản lý trích dẫn cho cả nhóm để thống nhất định dạng",
      "Hai người đọc độc lập 20% số bài ở vòng đọc toàn văn để kiểm tra mức nhất quán khi lọc",
      "Mỗi tuần họp 30 phút chỉ để thống nhất bài tranh cãi và cập nhật sơ đồ lọc",
    ],
  },

  design: {
    id: "design",
    goal:
      "Biến mô hình và giả thuyết thành kế hoạch đo lường cụ thể rồi thu thập dữ liệu đúng đạo đức, đủ cỡ mẫu, được làm sạch và mã hoá sẵn sàng phân tích.",
    duration: "3–6 tuần",
    steps: [
      {
        title: "Chốt thiết kế nghiên cứu và đối tượng",
        detail:
          "Xác định định lượng, định tính hay hỗn hợp; đối tượng, tiêu chí chọn, cách tiếp cận người tham gia, thời điểm thu thập. Mỗi giả thuyết phải chỉ ra biến nào đo bằng dữ liệu nào.",
        output: "Bảng «giả thuyết → biến → nguồn dữ liệu»",
        who: "Trưởng nhóm + giảng viên",
      },
      {
        title: "Chọn và thích nghi thang đo",
        detail:
          "Ưu tiên thang đo đã được kiểm định trong các bài ở bảng tổng hợp. Dịch xuôi – dịch ngược với bản gốc, chỉnh câu chữ cho phù hợp bối cảnh Việt Nam, ghi rõ nguồn từng thang đo và thang điểm (Likert 5 hay 7 mức).",
        output: "Bảng thang đo (biến, số câu, nguồn gốc, bản dịch)",
        who: "2 người dịch độc lập, 1 người đối chiếu",
      },
      {
        title: "Dựng phiếu khảo sát trên Surveylab",
        detail:
          "Nhập câu hỏi theo từng khối biến, thêm phần đồng thuận và câu hỏi nhân khẩu học. Đặt câu kiểm tra chú ý và bắt buộc các câu trọng yếu. Trộn thứ tự câu trong khối nếu cần giảm thiên lệch.",
        output: "Phiếu khảo sát bản nháp (đường dẫn thử)",
        toolAlias: "surveylab",
        who: "1 người phụ trách phiếu",
      },
      {
        title: "Khảo sát thử 15–30 người và chỉnh phiếu",
        detail:
          "Gửi cho nhóm nhỏ giống đối tượng thật, ghi lại câu bị hiểu sai, thời gian làm bài, câu bị bỏ trống. Sửa phiếu theo phản hồi, kiểm tra độ tin cậy sơ bộ (Cronbach's alpha) trước khi phát chính thức.",
        output: "Báo cáo khảo sát thử + phiếu bản v02",
        toolAlias: "surveylab",
        who: "Cả nhóm gửi bạn bè/lớp",
      },
      {
        title: "Tính cỡ mẫu và lập kế hoạch lấy mẫu",
        detail:
          "Tính cỡ mẫu tối thiểu theo phương pháp phân tích dự kiến (vd ≥ 10 lần số đường dẫn trong PLS-SEM, hoặc tính công suất). Ghi cách lấy mẫu, kênh phát phiếu, tỷ lệ phản hồi dự kiến và mục tiêu số phiếu mỗi tuần.",
        output: "Kế hoạch thu thập (cỡ mẫu, kênh, tiến độ theo tuần)",
        who: "Trưởng nhóm",
      },
      {
        title: "Hoàn tất thủ tục đạo đức và đồng thuận",
        detail:
          "Soạn thông tin cho người tham gia: mục đích, tự nguyện, ẩn danh, cách lưu và bảo mật dữ liệu, liên hệ. Làm thủ tục xét duyệt đạo đức nếu đơn vị yêu cầu; tra mẫu trong công cụ Quy trình, biểu mẫu.",
        output: "Phiếu đồng thuận + văn bản duyệt đạo đức (nếu có)",
        toolAlias: "regulations",
        who: "Trưởng nhóm + giảng viên",
      },
      {
        title: "Thu thập dữ liệu và theo dõi tiến độ",
        detail:
          "Phát phiếu theo kế hoạch, theo dõi số phiếu hợp lệ mỗi tuần trên Surveylab, nhắc nhở nhóm chưa phản hồi. Nếu có phỏng vấn, ghi âm khi được đồng ý và đặt tên tệp theo mã người tham gia, không dùng tên thật.",
        output: "Tệp dữ liệu thô (xuất từ Surveylab) + nhật ký thu thập",
        toolAlias: "surveylab",
        who: "Chia theo kênh/nhóm đối tượng",
      },
      {
        title: "Làm sạch và mã hoá dữ liệu",
        detail:
          "Loại phiếu không đạt (trả lời hàng loạt một mức, trượt câu kiểm tra, quá nhanh), xử lý giá trị thiếu, mã hoá lại câu đảo chiều, lập sổ biến (tên biến, nhãn, thang). Giữ riêng bản dữ liệu thô và bản đã làm sạch, ghi lại mọi thay đổi.",
        output: "Du-lieu_sach_v01.xlsx + So-bien.xlsx + ghi chú làm sạch",
        who: "1 người làm, 1 người kiểm tra chéo",
      },
    ],
    outputs: [
      "Bảng thang đo và phiếu khảo sát bản cuối (hoặc hướng dẫn phỏng vấn)",
      "Báo cáo khảo sát thử",
      "Kế hoạch cỡ mẫu và lấy mẫu",
      "Phiếu đồng thuận, văn bản duyệt đạo đức (nếu có)",
      "Dữ liệu thô, dữ liệu đã làm sạch và sổ biến",
    ],
    doneWhen: [
      "Số phiếu hợp lệ đạt cỡ mẫu tối thiểu đã tính",
      "Có bản dữ liệu thô và bản đã làm sạch riêng, kèm ghi chú những gì đã loại/sửa",
      "Sổ biến đủ để người khác mở dữ liệu ra hiểu được từng cột",
      "Mọi người tham gia đều đã đồng thuận và không còn thông tin nhận diện cá nhân trong tệp phân tích",
    ],
    mistakes: [
      "Tự viết thang đo mới khi đã có thang đo kiểm định, rồi không chứng minh được độ giá trị",
      "Bỏ qua khảo sát thử nên phát chính thức mới phát hiện câu hỏi khó hiểu",
      "Phát phiếu trong một nhóm bạn quen nên mẫu lệch và không đại diện",
      "Thu thập xong mới xin đồng thuận hoặc mới nghĩ đến đạo đức",
      "Sửa trực tiếp lên tệp dữ liệu thô, không còn bản gốc để đối chiếu",
      "Quên mã hoá lại câu đảo chiều nên độ tin cậy thấp một cách khó hiểu",
    ],
    teamTips: [
      "Một người duy nhất giữ quyền xuất dữ liệu từ Surveylab và đặt tên phiên bản, người khác chỉ dùng bản đã đặt tên",
      "Cập nhật số phiếu hợp lệ lên ghi chú giai đoạn mỗi tuần để cả nhóm thấy tiến độ",
      "Đặt mã người tham gia từ đầu (P001, P002…) và dùng nhất quán ở khảo sát, phỏng vấn, bóc băng",
      "Cho người ngoài nhóm đọc thử phiếu trước khi khảo sát thử để bắt lỗi chính tả, câu mơ hồ",
    ],
  },

  analyze: {
    id: "analyze",
    goal:
      "Biến dữ liệu thành kết quả kiểm chứng được: mô tả mẫu, kiểm tra chất lượng thang đo, kiểm định giả thuyết (định lượng) hoặc rút ra chủ đề (định tính), rồi diễn giải đúng với câu hỏi nghiên cứu.",
    duration: "2–4 tuần",
    steps: [
      {
        title: "Chốt kế hoạch phân tích và khoá phiên bản dữ liệu",
        detail:
          "Ghi trước các kiểm định sẽ chạy cho từng giả thuyết và mức ý nghĩa (thường 0,05). Chốt một phiên bản dữ liệu sạch có tên và ngày; mọi kết quả sau này ghi rõ chạy trên phiên bản nào.",
        output: "Ke-hoach-phan-tich.docx + tên phiên bản dữ liệu (vd Du-lieu_sach_v02)",
        who: "Trưởng nhóm + người phân tích chính",
      },
      {
        title: "Thống kê mô tả và kiểm tra dữ liệu",
        detail:
          "Tính tần số, trung bình, độ lệch chuẩn, độ lệch/nhọn, giá trị ngoại lai, giá trị thiếu. Lập bảng đặc điểm mẫu. Kiểm tra phân phối và sai lệch phương pháp chung (Harman) nếu dùng khảo sát một nguồn.",
        output: "Bảng 1 đặc điểm mẫu + Bảng 2 thống kê mô tả các biến",
        toolAlias: "quantis",
        who: "Người phân tích chính",
      },
      {
        title: "Kiểm tra độ tin cậy và độ giá trị thang đo",
        detail:
          "Chạy Cronbach's alpha, hệ số tải, độ tin cậy tổng hợp (CR), phương sai trích (AVE), độ giá trị phân biệt (HTMT hoặc Fornell–Larcker); với EFA/CFA kiểm tra KMO, phương sai giải thích, chỉ số phù hợp mô hình. Loại hoặc giữ biến quan sát theo ngưỡng đã ghi trong kế hoạch.",
        output: "Bảng độ tin cậy và độ giá trị (kèm ghi chú biến đã loại)",
        toolAlias: "quantis",
        who: "Người phân tích chính, người khác kiểm lại",
      },
      {
        title: "Kiểm định giả thuyết bằng mô hình",
        detail:
          "Chạy mô hình đã chọn (hồi quy, PLS-SEM, SEM…). Ghi hệ số đường dẫn, sai số chuẩn, giá trị p hoặc khoảng tin cậy bootstrap và R². Mỗi giả thuyết có kết luận rõ: ủng hộ hoặc không ủng hộ.",
        output: "Bảng kết quả kiểm định giả thuyết + sơ đồ mô hình có hệ số",
        toolAlias: "quantis",
        who: "Người phân tích chính",
      },
      {
        title: "Phân tích sâu: điều tiết, trung gian, so sánh nhóm",
        detail:
          "Chạy các phân tích bổ sung nêu trong giả thuyết hoặc đề cương (vd biến trung gian, nhóm theo giới/ngành). Chỉ chạy những gì có lý thuyết hỗ trợ, tránh lục tìm kết quả «có ý nghĩa».",
        output: "Bảng kết quả bổ sung kèm nhận xét ngắn",
        toolAlias: "quantis",
        who: "Người phân tích chính",
      },
      {
        title: "Phân tích dữ liệu định tính (nếu có)",
        detail:
          "Bóc băng phỏng vấn bằng công cụ Phân tích định tính, đọc toàn bộ một lượt, mã hoá mở rồi gom thành chủ đề. Hai người mã hoá độc lập một phần dữ liệu và thống nhất sổ mã. Chọn trích dẫn minh hoạ không lộ danh tính.",
        output: "Sổ mã, bản đồ chủ đề và bộ trích dẫn minh hoạ",
        toolAlias: "annota",
        who: "Hai người mã hoá",
      },
      {
        title: "Diễn giải kết quả và đối chiếu tài liệu",
        detail:
          "Với mỗi giả thuyết: kết quả là gì, có phù hợp với bài trong bảng tổng hợp không, giải thích khả dĩ nếu khác. Ghi hạn chế (mẫu, thiết kế cắt ngang, thang đo tự báo cáo) và hướng nghiên cứu tiếp.",
        output: "Bản nháp mục Kết quả và Thảo luận (dàn ý + bảng, hình)",
        who: "Cả nhóm thảo luận, 1 người viết",
      },
      {
        title: "Lưu cấu hình, mã lệnh và kết quả để tái lập",
        detail:
          "Lưu tệp cấu hình/ghi chú các bước đã chạy, phiên bản phần mềm, hạt giống ngẫu nhiên (nếu có), đầu ra thô. Người ngoài nhóm phải chạy lại được ra cùng bảng số liệu.",
        output: "Thư mục «Phan-tich_v02» (cấu hình, đầu ra thô, hướng dẫn chạy lại)",
        who: "Người phân tích chính",
      },
    ],
    outputs: [
      "Kế hoạch phân tích và tên phiên bản dữ liệu đã dùng",
      "Bảng đặc điểm mẫu, thống kê mô tả, độ tin cậy và độ giá trị",
      "Bảng kiểm định giả thuyết và sơ đồ mô hình",
      "Sổ mã và chủ đề (nếu có dữ liệu định tính)",
      "Bản nháp Kết quả và Thảo luận, gói tái lập kết quả",
    ],
    doneWhen: [
      "Mỗi giả thuyết/câu hỏi nghiên cứu có kết luận kèm số liệu",
      "Độ tin cậy và độ giá trị thang đo đạt ngưỡng hoặc đã giải thích lý do chưa đạt",
      "Một người khác trong nhóm đã chạy lại và ra cùng kết quả",
      "Mọi bảng, hình đưa vào bài đều truy được về phiên bản dữ liệu và bước chạy",
    ],
    mistakes: [
      "Chạy thử nhiều kiểm định, chỉ báo cáo cái «có ý nghĩa» (p-hacking)",
      "Loại biến, loại phiếu sau khi đã thấy kết quả mà không ghi lý do",
      "Báo cáo giá trị p mà không báo cáo độ lớn ảnh hưởng và khoảng tin cậy",
      "Kết luận quan hệ nhân quả từ dữ liệu cắt ngang",
      "Kết quả chạy trên nhiều bản dữ liệu khác nhau nên các bảng không khớp nhau",
      "Trích dẫn định tính lộ tên người tham gia hoặc đơn vị",
    ],
    teamTips: [
      "Chỉ một người chạy mô hình chính; người còn lại độc lập tái lập các bảng chính để bắt lỗi",
      "Ghi vào ghi chú giai đoạn: dữ liệu bản nào, ngày nào, công cụ nào mỗi khi có kết quả mới",
      "Họp «đọc kết quả» với giảng viên trước khi viết, để tránh viết dựa trên diễn giải sai",
      "Phân tích định tính: mã hoá độc lập trước, rồi mới so sổ mã, không mã chung từ đầu",
    ],
  },

  write: {
    id: "write",
    goal:
      "Viết thành bài hoàn chỉnh theo chuẩn bài báo (hoặc báo cáo), qua nhiều vòng đọc chéo và tự phản biện, kiểm tra đạo văn và trích dẫn trước khi gửi đi.",
    duration: "3–6 tuần",
    steps: [
      {
        title: "Lập dàn ý IMRaD và phân công từng phần",
        detail:
          "Dàn ý gồm Giới thiệu, Tổng quan/Cơ sở lý thuyết, Phương pháp, Kết quả, Thảo luận, Kết luận, Tài liệu tham khảo. Ghi người viết chính, người đọc chéo và hạn nộp cho từng phần; chốt thứ tự tác giả và vai trò đóng góp sớm.",
        output: "Dan-y_IMRaD.docx + bảng phân công, thứ tự tác giả",
        who: "Trưởng nhóm",
      },
      {
        title: "Viết bản nháp đầu từng phần theo phân công",
        detail:
          "Viết trong Writium hoặc một tệp chung duy nhất, không gửi nhiều bản qua tin nhắn. Phần Phương pháp và Kết quả viết trước vì đã có sẵn dữ liệu; Giới thiệu và Kết luận viết sau cùng.",
        output: "Ban-nhap_v01.docx (đủ các phần)",
        toolAlias: "writium",
        who: "Mỗi người một phần",
      },
      {
        title: "Thống nhất giọng văn, thuật ngữ và trích dẫn",
        detail:
          "Lập bảng thuật ngữ (một khái niệm một cách gọi). Chọn một kiểu trích dẫn (APA 7 hoặc theo tạp chí đích) và áp dụng cho cả bài; rà từng trích dẫn trong văn bản có trong danh mục tham khảo và ngược lại.",
        output: "Bảng thuật ngữ + danh mục tham khảo đã chuẩn hoá",
        toolAlias: "writium",
        who: "1 người biên tập",
      },
      {
        title: "Đọc chéo nội bộ giữa các thành viên",
        detail:
          "Mỗi phần do một người khác đọc, góp ý trực tiếp bằng chú thích trên tệp. Người viết phản hồi từng góp ý (sửa/không sửa và lý do). Ít nhất một vòng đọc từ đầu đến cuối bởi người không viết phần đó.",
        output: "Ban-nhap_v02.docx kèm chú thích đã xử lý",
        who: "Đọc chéo vòng tròn",
      },
      {
        title: "Tự phản biện bằng Phản biện bài báo",
        detail:
          "Chạy bản v02 qua công cụ Phản biện bài báo để có góp ý như phản biện: giả thuyết, phương pháp, lập luận, trình bày. Đọc kỹ, lập bảng «góp ý → cách sửa» và chỉ bỏ qua góp ý khi có lý do bằng văn bản.",
        output: "Bảng góp ý phản biện và cách xử lý",
        toolAlias: "paperreviewer",
        who: "Người viết chính + trưởng nhóm",
      },
      {
        title: "Kiểm tra đạo văn và mức trùng lặp",
        detail:
          "Chạy bản gần cuối qua công cụ Kiểm tra đạo văn. Xem từng đoạn bị đánh dấu: sửa lại bằng cách diễn đạt của mình và trích dẫn đúng; tự trích lại bài cũ của nhóm phải ghi rõ nguồn.",
        output: "Báo cáo kiểm tra đạo văn và bản đã chỉnh",
        toolAlias: "plagiarismchecker",
        who: "Người biên tập",
      },
      {
        title: "Giảng viên hướng dẫn góp ý và duyệt bản cuối",
        detail:
          "Gửi bản đã sạch cho giảng viên (vai Xem hoặc Biên tập tuỳ thoả thuận). Tập hợp góp ý một đợt, sửa, rồi tất cả tác giả đọc lại bản cuối và xác nhận đồng ý nội dung.",
        output: "Ban-cuoi_v03.docx + xác nhận của tất cả tác giả",
        who: "Cả nhóm",
      },
    ],
    outputs: [
      "Dàn ý, bảng phân công và thứ tự tác giả",
      "Bản thảo hoàn chỉnh (bản cuối) và danh mục tham khảo chuẩn hoá",
      "Bảng góp ý phản biện và cách xử lý",
      "Báo cáo kiểm tra đạo văn",
    ],
    doneWhen: [
      "Mọi tác giả đã đọc toàn bài và đồng ý với bản cuối",
      "Mọi góp ý quan trọng của phản biện (công cụ, giảng viên) đã được sửa hoặc có lý do không sửa",
      "Tỷ lệ trùng lặp ở mức chấp nhận được, các đoạn trùng đều có trích dẫn đúng",
      "Mọi trích dẫn trong văn bản đều có trong danh mục tham khảo, và ngược lại",
    ],
    mistakes: [
      "Mỗi người giữ một bản riêng, cuối cùng phải ghép tay và mất chỉnh sửa của nhau",
      "Viết Giới thiệu trước khi có kết quả nên kết luận không khớp với mục tiêu",
      "Bỏ qua góp ý phản biện khó chịu mà không ghi lý do",
      "Chép nguyên văn từ bài tiếng Anh rồi dịch sát chữ, dẫn đến trùng lặp và câu khó hiểu",
      "Chỉ bàn thứ tự tác giả vào phút cuối",
      "Trích dẫn bài chưa đọc hoặc để lại trích dẫn không có trong danh mục",
    ],
    teamTips: [
      "Một tệp chung duy nhất; đặt hạn «khoá phần» để người đọc chéo không phải đọc bản đang sửa",
      "Dùng bản đánh số v01, v02, v03 và ghi người sửa vào tên tệp",
      "Họp 20 phút cuối mỗi tuần chỉ để cập nhật phần nào còn trễ",
      "Trước khi gửi, mỗi tác giả tự đọc phần Phương pháp và Kết quả để chắc chắn mô tả đúng việc đã làm",
    ],
  },

  publish: {
    id: "publish",
    goal:
      "Chọn đúng nơi công bố, chuẩn bị gói nộp đầy đủ, gửi bài, theo dõi và xử lý phản hồi; song song tìm nguồn tài trợ hoặc làm thủ tục nội bộ nếu cần.",
    duration: "2–8 tuần chuẩn bị gửi, thêm 2–6 tháng chờ phản hồi",
    steps: [
      {
        title: "Lập danh sách 3–5 nơi công bố phù hợp",
        detail:
          "Dùng công cụ Hội thảo tạp chí với tiêu đề và từ khoá của bài. So sánh phạm vi, chỉ số (Scopus/WoS/ISI, xếp hạng), thời gian phản hồi, phí xuất bản, tỷ lệ chấp nhận, ngôn ngữ. Xếp thứ tự ưu tiên và ghi cả phương án dự phòng.",
        output: "Bảng so sánh 3–5 nơi nộp + lựa chọn chính, phương án dự phòng",
        toolAlias: "journal-conference",
        who: "Trưởng nhóm + giảng viên",
      },
      {
        title: "Kiểm tra yêu cầu của nơi nộp",
        detail:
          "Đọc kỹ hướng dẫn tác giả: giới hạn số từ, cấu trúc, kiểu trích dẫn, định dạng hình bảng, yêu cầu về dữ liệu và đạo đức, quy định dùng công cụ AI. Lập danh sách kiểm tra từng mục.",
        output: "Danh sách kiểm tra yêu cầu nộp bài",
        who: "1 người biên tập",
      },
      {
        title: "Định dạng bài theo mẫu của nơi nộp",
        detail:
          "Chuyển bài sang mẫu của tạp chí/hội thảo, rút gọn hoặc mở rộng đúng giới hạn, chuẩn hoá hình, bảng, tóm tắt, từ khoá. Soạn trang tên bài riêng (nếu nộp ẩn danh).",
        output: "Ban-nop_dinh-dang-theo-mau.docx/pdf",
        toolAlias: "writium",
        who: "Người biên tập",
      },
      {
        title: "Soạn thư gửi biên tập và hồ sơ đi kèm",
        detail:
          "Viết thư 1 trang: đóng góp chính, vì sao phù hợp với tạp chí, xác nhận chưa gửi nơi khác, không xung đột lợi ích. Chuẩn bị tệp bổ sung: dữ liệu/phụ lục, tuyên bố đạo đức, đóng góp của từng tác giả, mã ORCID.",
        output: "Thu-gui-bien-tap.docx + bộ tệp bổ sung",
        who: "Tác giả liên hệ",
      },
      {
        title: "Làm thủ tục nội bộ và xin duyệt cần thiết",
        detail:
          "Tra quy trình, biểu mẫu nội bộ của Đại học Kinh tế Quốc dân trong công cụ Quy trình, biểu mẫu (xác nhận đề tài, đơn vị công tác, kê khai công bố, thanh toán phí nếu có). Hoàn tất trước khi nộp để không phải sửa thông tin sau.",
        output: "Các biểu mẫu nội bộ đã điền và ký",
        toolAlias: "regulations",
        who: "Tác giả liên hệ + trưởng nhóm",
      },
      {
        title: "Nộp bài và lưu bằng chứng nộp",
        detail:
          "Một người duy nhất nộp bài và theo dõi hộp thư. Sau khi nộp, lưu email xác nhận, mã bài, ngày nộp và đưa vào dự án; chuyển trạng thái giai đoạn và ghi ngày dự kiến có phản hồi.",
        output: "Xác nhận nộp bài (mã bài, ngày nộp) tải lên thư mục Công bố",
        who: "Tác giả liên hệ",
      },
      {
        title: "Xử lý phản hồi phản biện và sửa bài",
        detail:
          "Khi có phản hồi, họp nhóm trong 3 ngày để chia việc. Viết thư trả lời từng ý (trích góp ý, nêu cách sửa, chỉ rõ số dòng/trang), sửa bài và đánh dấu thay đổi. Nếu bị từ chối, sửa theo góp ý rồi nộp nơi dự phòng.",
        output: "Thu-tra-loi-phan-bien.docx + bản sửa đánh dấu thay đổi",
        toolAlias: "paperreviewer",
        who: "Cả nhóm, tác giả liên hệ gửi",
      },
      {
        title: "Tìm nguồn tài trợ cho hướng nghiên cứu tiếp theo",
        detail:
          "Dùng công cụ Tra cứu quỹ tài trợ để tìm quỹ phù hợp (trong và ngoài nước), ghi hạn nộp, quy mô, điều kiện. Chọn 1–2 quỹ khả thi, phác ý tưởng đề xuất từ khoảng trống còn lại sau bài này.",
        output: "Bảng 1–3 quỹ phù hợp (hạn nộp, điều kiện) + ý tưởng đề xuất",
        toolAlias: "funds",
        who: "Trưởng nhóm + giảng viên",
      },
    ],
    outputs: [
      "Bảng so sánh nơi nộp và lựa chọn đã chốt",
      "Gói nộp (bài đã định dạng, thư gửi biên tập, tệp bổ sung)",
      "Biểu mẫu nội bộ đã hoàn tất",
      "Xác nhận nộp bài và thư trả lời phản biện",
      "Danh sách quỹ tài trợ tiềm năng",
    ],
    doneWhen: [
      "Bài đã nộp và lưu được mã bài cùng email xác nhận",
      "Thủ tục nội bộ đã hoàn tất, không còn giấy tờ thiếu",
      "Có người chịu trách nhiệm theo dõi và ngày kiểm tra phản hồi",
      "Khi có kết quả: đã nhận (xuất bản), hoặc từ chối đã chuyển sang nơi dự phòng",
    ],
    mistakes: [
      "Chọn tạp chí theo chỉ số mà không kiểm tra phạm vi nên bị từ chối ngay vòng đầu",
      "Không đọc hướng dẫn tác giả nên bị trả về vì sai định dạng",
      "Nộp song song nhiều nơi (vi phạm đạo đức xuất bản)",
      "Nộp vào tạp chí săn mồi vì lời mời qua email",
      "Trả lời phản biện bằng giọng phòng thủ, không sửa thật sự",
      "Nhiều người cùng liên hệ biên tập, thông tin chồng chéo",
    ],
    teamTips: [
      "Chỉ một tác giả liên hệ; mọi thư từ gửi cho nhóm qua một thư mục chung trong dự án",
      "Lập sẵn bảng tiến độ phản biện (vòng, ngày nhận, hạn trả lời) trong ghi chú giai đoạn",
      "Sau khi có phản hồi, họp ngắn để chia việc: ai sửa mục nào, ai viết thư trả lời",
      "Giảng viên giữ vai Biên tập hoặc Xem để theo dõi tiến trình và góp ý kịp thời",
    ],
  },
}

export const PROJECT_SETUP_GUIDE: {
  title: string
  steps: { title: string; detail: string }[]
  roles: { role: "owner" | "editor" | "viewer"; label: string; can: string }[]
  fileNaming: string[]
  weeklyRhythm: string[]
} = {
  title: "Thiết lập dự án nghiên cứu trên AI Portal",
  steps: [
    {
      title: "Trưởng nhóm tạo dự án",
      detail:
        "Trong thanh bên trái, mục «Dự án của tôi», bấm dấu «+» (Thêm dự án). Đặt tên ngắn, nêu được đề tài (vd «Ảnh hưởng của chatbot AI đến động lực học tập của sinh viên»). Một nhóm chỉ tạo một dự án; không mỗi người một dự án.",
    },
    {
      title: "Ghi câu hỏi nghiên cứu vào mô tả",
      detail:
        "Phần mô tả ghi câu hỏi nghiên cứu sơ bộ, đối tượng và kết quả mong đợi trong 3–5 dòng. Trợ lý chính đọc mô tả này khi trả lời trong dự án nên càng rõ càng tốt; cập nhật khi câu hỏi thay đổi.",
    },
    {
      title: "Gắn thẻ để dễ tìm",
      detail:
        "Thêm 2–4 thẻ: lĩnh vực, phương pháp, học phần/đợt (vd «giáo dục», «PLS-SEM», «NCKH SV 2026»).",
    },
    {
      title: "Mời thành viên bằng email và chọn vai",
      detail:
        "Mở dự án → «Chỉnh sửa dự án» → tab Thành viên, nhập email mà mỗi người dùng để đăng nhập Portal rồi bấm Thêm. Người chưa có tài khoản được ghi «Chờ đăng nhập» và sẽ thấy dự án ngay khi đăng nhập lần đầu bằng đúng email đó. Chọn vai: Biên tập cho người cùng làm, Xem cho giảng viên hướng dẫn và người góp ý.",
    },
    {
      title: "Bật vòng đời và đặt hạn từng giai đoạn",
      detail:
        "Trong «Chỉnh sửa dự án» → tab Vòng đời nghiên cứu (hoặc nút «Quản lý vòng đời» ở trang dự án), chuyển giai đoạn Tìm hiểu sang «đang thực hiện» và đặt ngày dự kiến hoàn thành cho cả 6 giai đoạn. Hạn có thể sửa nhưng phải có khi bắt đầu để nhóm thấy mình đang ở đâu.",
    },
    {
      title: "Nạp checklist mẫu và giao việc",
      detail:
        "Ở mỗi giai đoạn, dùng «Nạp checklist mẫu» để lấy các bước gợi ý, xoá bước không cần, thêm bước riêng của đề tài rồi giao từng việc cho một người cụ thể kèm hạn. Mỗi việc chỉ một người chịu trách nhiệm.",
    },
    {
      title: "Tải tài liệu lên và dùng Trợ lý chính trong dự án",
      detail:
        "Tải đề cương, bảng tổng hợp, dữ liệu, bản thảo lên tab Tài liệu (ô «Thư mục» để xếp theo giai đoạn) từng giai đoạn. Khi trò chuyện với Trợ lý chính trong dự án, Trợ lý biết tên dự án, giai đoạn hiện tại, việc còn mở và tệp của dự án nên có thể gợi ý bước kế tiếp và công cụ phù hợp.",
    },
  ],
  roles: [
    {
      role: "owner",
      label: "Chủ dự án (trưởng nhóm)",
      can: "Toàn quyền: đổi tên, mô tả, thẻ; mời, đổi vai, xoá thành viên; chỉnh vòng đời và checklist; tải, đổi tên, xoá mọi tệp; xoá dự án.",
    },
    {
      role: "editor",
      label: "Biên tập (thành viên làm việc)",
      can: "Xem dự án; đổi trạng thái, ghi chú, hạn của giai đoạn; thêm, tick, giao việc trong checklist; tải tệp lên, đổi tên và xoá tệp do mình tải; dùng Trợ lý chính với ngữ cảnh dự án.",
    },
    {
      role: "viewer",
      label: "Xem (giảng viên, người góp ý)",
      can: "Chỉ đọc: xem dự án, vòng đời và checklist, tải tệp xuống, dùng Trợ lý chính với ngữ cảnh dự án. Không sửa, không tải lên.",
    },
  ],
  fileNaming: [
    "Cấu trúc: ngày_giai-đoạn_nội-dung_phiên-bản_người-sửa, vd 2026-11-13_B2_tong-quan_v02_Lam.docx",
    "Ngày theo dạng năm-tháng-ngày để sắp xếp đúng thứ tự; giai đoạn dùng B1–B6 (B1 Tìm hiểu … B6 Công bố)",
    "Không dấu tiếng Việt, không khoảng trắng; dùng gạch ngang trong từ ghép",
    "Mỗi lần sửa lớn tăng số phiên bản (v01, v02, v03); không ghi đè lên tệp cũ, không đặt tên «cuoi», «cuoi-cung»",
    "Dữ liệu thô không bao giờ sửa; bản đã làm sạch đặt tên Du-lieu_sach_vXX",
    "Mỗi giai đoạn một thư mục trong tab Tài liệu (01-Tim-hieu, 02-Tong-quan, 03-Thu-thap, 04-Phan-tich, 05-Viet, 06-Cong-bo)",
  ],
  weeklyRhythm: [
    "Họp nhóm cố định mỗi tuần 30–45 phút, cùng giờ cùng ngày, có biên bản 5 dòng ghi vào ghi chú giai đoạn",
    "Đầu buổi họp: mỗi người nói đã làm gì, tuần tới làm gì, đang vướng gì (3 câu)",
    "Trước buổi họp: mỗi người tự tick việc đã xong và tải tệp lên Portal",
    "Cuối buổi họp: trưởng nhóm cập nhật trạng thái giai đoạn, hạn, người được giao việc",
    "Hai tuần một lần gửi giảng viên bản tóm tắt tiến độ (1 trang) hoặc mời giảng viên xem vòng đời",
    "Chuyển giai đoạn khi đạt đủ điều kiện «sang giai đoạn sau» trong hướng dẫn, không chuyển chỉ vì đến hạn",
  ],
}
