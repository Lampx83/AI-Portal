// Định nghĩa lĩnh vực và bộ dữ liệu nghiên cứu
export type RawDataRow = Record<string, string | number>

export const DOMAINS = [
  { id: "kinh-te", name: "Kinh tế", description: "Dữ liệu kinh tế vĩ mô, tài chính, thương mại", order: 1 },
  { id: "giao-duc", name: "Giáo dục", description: "Khảo sát, đánh giá, kết quả học tập", order: 2 },
  { id: "y-te", name: "Y tế", description: "Dịch tễ, sức khỏe cộng đồng, chi phí y tế", order: 3 },
  { id: "cong-nghe", name: "Công nghệ", description: "Startup, doanh thu ngành IT, xu hướng", order: 4 },
  { id: "moi-truong", name: "Môi trường", description: "Chất lượng không khí, năng lượng, phát thải", order: 5 },
  { id: "xa-hoi", name: "Xã hội", description: "Dân số, mức sống, di cư", order: 6 },
  { id: "nong-nghiep", name: "Nông nghiệp", description: "Năng suất, xuất khẩu nông sản", order: 7 },
  { id: "khac", name: "Khác", description: "Dữ liệu tổng hợp và phân tích", order: 99 },
] as const

export type DatasetDef = {
  id: string
  title: string
  description: string
  type: string
  domain: string
  raw_data: RawDataRow[]
}

export const DATASETS: DatasetDef[] = [
  // === KINH TẾ ===
  {
    id: "macro-vn",
    title: "Kinh tế vĩ mô Việt Nam",
    description: "GDP, lạm phát, thất nghiệp, lãi suất, cán cân TM, nợ công (theo quý 2019-2024)",
    type: "macro",
    domain: "kinh-te",
    raw_data: [
      { "Năm": 2019, "Quý": "Q1", "Tăng trưởng GDP (%)": 6.8, "Lạm phát (%)": 2.7, "Thất nghiệp (%)": 2.0, "Lãi suất cơ bản (%)": 6.25, "Cán cân TM (tỷ USD)": 0.8, "Xuất khẩu (tỷ USD)": 58.5, "Nhập khẩu (tỷ USD)": 57.7, "Nợ công (% GDP)": 55.8 },
      { "Năm": 2019, "Quý": "Q2", "Tăng trưởng GDP (%)": 6.7, "Lạm phát (%)": 2.2, "Thất nghiệp (%)": 2.2, "Lãi suất cơ bản (%)": 6.25, "Cán cân TM (tỷ USD)": 1.2, "Xuất khẩu (tỷ USD)": 61.2, "Nhập khẩu (tỷ USD)": 60.0, "Nợ công (% GDP)": 56.1 },
      { "Năm": 2020, "Quý": "Q1", "Tăng trưởng GDP (%)": 3.7, "Lạm phát (%)": 5.6, "Thất nghiệp (%)": 2.2, "Lãi suất cơ bản (%)": 5.0, "Cán cân TM (tỷ USD)": 2.8, "Xuất khẩu (tỷ USD)": 58.9, "Nhập khẩu (tỷ USD)": 56.1, "Nợ công (% GDP)": 55.3 },
      { "Năm": 2020, "Quý": "Q2", "Tăng trưởng GDP (%)": 0.4, "Lạm phát (%)": 3.2, "Thất nghiệp (%)": 2.7, "Lãi suất cơ bản (%)": 4.5, "Cán cân TM (tỷ USD)": 5.4, "Xuất khẩu (tỷ USD)": 60.2, "Nhập khẩu (tỷ USD)": 54.8, "Nợ công (% GDP)": 55.8 },
      { "Năm": 2021, "Quý": "Q3", "Tăng trưởng GDP (%)": -6.0, "Lạm phát (%)": 2.1, "Thất nghiệp (%)": 3.2, "Lãi suất cơ bản (%)": 4.0, "Cán cân TM (tỷ USD)": 1.1, "Xuất khẩu (tỷ USD)": 80.6, "Nhập khẩu (tỷ USD)": 79.5, "Nợ công (% GDP)": 43.8 },
      { "Năm": 2022, "Quý": "Q2", "Tăng trưởng GDP (%)": 7.7, "Lạm phát (%)": 3.2, "Thất nghiệp (%)": 2.3, "Lãi suất cơ bản (%)": 4.0, "Cán cân TM (tỷ USD)": 1.2, "Xuất khẩu (tỷ USD)": 96.5, "Nhập khẩu (tỷ USD)": 95.3, "Nợ công (% GDP)": 42.6 },
      { "Năm": 2023, "Quý": "Q4", "Tăng trưởng GDP (%)": 6.7, "Lạm phát (%)": 3.2, "Thất nghiệp (%)": 2.2, "Lãi suất cơ bản (%)": 4.5, "Cán cân TM (tỷ USD)": 9.1, "Xuất khẩu (tỷ USD)": 98.0, "Nhập khẩu (tỷ USD)": 88.9, "Nợ công (% GDP)": 36.2 },
      { "Năm": 2024, "Quý": "Q3", "Tăng trưởng GDP (%)": 6.4, "Lạm phát (%)": 4.0, "Thất nghiệp (%)": 2.1, "Lãi suất cơ bản (%)": 4.25, "Cán cân TM (tỷ USD)": 10.5, "Xuất khẩu (tỷ USD)": 102.5, "Nhập khẩu (tỷ USD)": 92.0, "Nợ công (% GDP)": 34.8 },
    ],
  },
  {
    id: "fdi-vn",
    title: "Vốn FDI vào Việt Nam",
    description: "Vốn FDI đăng ký và giải ngân theo ngành, quốc gia (2020-2024)",
    type: "macro",
    domain: "kinh-te",
    raw_data: [
      { "Năm": 2020, "Ngành": "Công nghiệp chế biến", "Vốn đăng ký (tỷ USD)": 12.5, "Vốn giải ngân (tỷ USD)": 19.2, "Số dự án": 1234 },
      { "Năm": 2020, "Ngành": "Bất động sản", "Vốn đăng ký (tỷ USD)": 3.8, "Vốn giải ngân (tỷ USD)": 4.2, "Số dự án": 89 },
      { "Năm": 2021, "Ngành": "Công nghiệp chế biến", "Vốn đăng ký (tỷ USD)": 18.2, "Vốn giải ngân (tỷ USD)": 16.8, "Số dự án": 1105 },
      { "Năm": 2022, "Ngành": "Công nghiệp chế biến", "Vốn đăng ký (tỷ USD)": 21.5, "Vốn giải ngân (tỷ USD)": 19.5, "Số dự án": 1289 },
      { "Năm": 2023, "Ngành": "Công nghiệp chế biến", "Vốn đăng ký (tỷ USD)": 23.1, "Vốn giải ngân (tỷ USD)": 21.2, "Số dự án": 1320 },
      { "Năm": 2024, "Ngành": "Công nghiệp chế biến", "Vốn đăng ký (tỷ USD)": 15.2, "Vốn giải ngân (tỷ USD)": 12.8, "Số dự án": 856 },
    ],
  },
  {
    id: "lam-phat-asean",
    title: "Lạm phát các nước ASEAN",
    description: "Chỉ số CPI so với cùng kỳ năm trước (%)",
    type: "macro",
    domain: "kinh-te",
    raw_data: [
      { "Năm": 2023, "Quốc gia": "Việt Nam", "Lạm phát (%)": 3.2, "GDP tăng trưởng (%)": 5.0 },
      { "Năm": 2023, "Quốc gia": "Thái Lan", "Lạm phát (%)": 1.2, "GDP tăng trưởng (%)": 3.8 },
      { "Năm": 2023, "Quốc gia": "Indonesia", "Lạm phát (%)": 2.6, "GDP tăng trưởng (%)": 5.0 },
      { "Năm": 2023, "Quốc gia": "Malaysia", "Lạm phát (%)": 2.5, "GDP tăng trưởng (%)": 4.2 },
      { "Năm": 2023, "Quốc gia": "Philippines", "Lạm phát (%)": 6.0, "GDP tăng trưởng (%)": 5.5 },
      { "Năm": 2024, "Quốc gia": "Việt Nam", "Lạm phát (%)": 4.0, "GDP tăng trưởng (%)": 6.3 },
      { "Năm": 2024, "Quốc gia": "Thái Lan", "Lạm phát (%)": 0.9, "GDP tăng trưởng (%)": 3.2 },
    ],
  },

  // === GIÁO DỤC ===
  {
    id: "khao-sat-sinh-vien",
    title: "Khảo sát mức độ hài lòng sinh viên",
    description: "Đánh giá mức độ hài lòng về cơ sở vật chất, giảng viên, chương trình đào tạo",
    type: "survey",
    domain: "giao-duc",
    raw_data: [
      { "Danh mục": "Rất hài lòng", "Số lượng": 125, "Phần trăm": 42 },
      { "Danh mục": "Hài lòng", "Số lượng": 98, "Phần trăm": 33 },
      { "Danh mục": "Bình thường", "Số lượng": 45, "Phần trăm": 15 },
      { "Danh mục": "Không hài lòng", "Số lượng": 22, "Phần trăm": 7 },
      { "Danh mục": "Rất không hài lòng", "Số lượng": 10, "Phần trăm": 3 },
    ],
  },
  {
    id: "ket-qua-hoc-tap",
    title: "Kết quả học tập theo khoa",
    description: "Điểm trung bình và tỷ lệ tốt nghiệp theo khoa (2023-2024)",
    type: "survey",
    domain: "giao-duc",
    raw_data: [
      { "Khoa": "Công nghệ thông tin", "Điểm TB": 3.45, "Tỷ lệ tốt nghiệp (%)": 92, "Sinh viên": 1250 },
      { "Khoa": "Kinh tế", "Điểm TB": 3.32, "Tỷ lệ tốt nghiệp (%)": 88, "Sinh viên": 2100 },
      { "Khoa": "Ngoại ngữ", "Điểm TB": 3.28, "Tỷ lệ tốt nghiệp (%)": 90, "Sinh viên": 680 },
      { "Khoa": "Điện - Điện tử", "Điểm TB": 3.38, "Tỷ lệ tốt nghiệp (%)": 85, "Sinh viên": 920 },
      { "Khoa": "Cơ khí", "Điểm TB": 3.25, "Tỷ lệ tốt nghiệp (%)": 82, "Sinh viên": 750 },
    ],
  },
  {
    id: "ty-le-tot-nghiep",
    title: "Tỷ lệ tốt nghiệp theo năm",
    description: "Xu hướng tỷ lệ tốt nghiệp đại học (2019-2024)",
    type: "survey",
    domain: "giao-duc",
    raw_data: [
      { "Năm": 2019, "Tỷ lệ tốt nghiệp (%)": 85.2, "Số SV tốt nghiệp": 4250 },
      { "Năm": 2020, "Tỷ lệ tốt nghiệp (%)": 82.1, "Số SV tốt nghiệp": 4100 },
      { "Năm": 2021, "Tỷ lệ tốt nghiệp (%)": 80.5, "Số SV tốt nghiệp": 3980 },
      { "Năm": 2022, "Tỷ lệ tốt nghiệp (%)": 86.8, "Số SV tốt nghiệp": 4320 },
      { "Năm": 2023, "Tỷ lệ tốt nghiệp (%)": 88.2, "Số SV tốt nghiệp": 4450 },
      { "Năm": 2024, "Tỷ lệ tốt nghiệp (%)": 89.5, "Số SV tốt nghiệp": 4520 },
    ],
  },

  // === Y TẾ ===
  {
    id: "dich-te-covid",
    title: "Dịch tễ COVID-19",
    description: "Số ca mắc, khỏi bệnh, tử vong theo tháng (2020-2022)",
    type: "health",
    domain: "y-te",
    raw_data: [
      { "Tháng": "2020-08", "Ca mắc": 1050, "Khỏi bệnh": 980, "Tử vong": 12 },
      { "Tháng": "2021-07", "Ca mắc": 125000, "Khỏi bệnh": 95000, "Tử vong": 450 },
      { "Tháng": "2021-08", "Ca mắc": 185000, "Khỏi bệnh": 142000, "Tử vong": 3200 },
      { "Tháng": "2021-09", "Ca mắc": 142000, "Khỏi bệnh": 158000, "Tử vong": 2800 },
      { "Tháng": "2022-01", "Ca mắc": 185000, "Khỏi bệnh": 165000, "Tử vong": 420 },
    ],
  },
  {
    id: "chi-phi-y-te",
    title: "Chi phí y tế bình quân",
    description: "Chi tiêu y tế bình quân đầu người theo vùng (triệu VND/năm)",
    type: "health",
    domain: "y-te",
    raw_data: [
      { "Vùng": "Đồng bằng sông Hồng", "Chi phí (triệu VND)": 4.2, "Tỷ lệ GDP (%)": 5.8 },
      { "Vùng": "Đông Nam Bộ", "Chi phí (triệu VND)": 5.1, "Tỷ lệ GDP (%)": 6.2 },
      { "Vùng": "Đồng bằng sông Cửu Long", "Chi phí (triệu VND)": 3.2, "Tỷ lệ GDP (%)": 5.1 },
      { "Vùng": "Trung du miền núi phía Bắc", "Chi phí (triệu VND)": 2.8, "Tỷ lệ GDP (%)": 6.5 },
      { "Vùng": "Tây Nguyên", "Chi phí (triệu VND)": 2.5, "Tỷ lệ GDP (%)": 5.9 },
    ],
  },

  // === CÔNG NGHỆ ===
  {
    id: "startup-vietnam",
    title: "Startup Việt Nam",
    description: "Số lượng startup và vốn đầu tư theo lĩnh vực (2022-2024)",
    type: "technology",
    domain: "cong-nghe",
    raw_data: [
      { "Năm": 2022, "Lĩnh vực": "Fintech", "Số startup": 185, "Vốn (triệu USD)": 450 },
      { "Năm": 2022, "Lĩnh vực": "E-commerce", "Số startup": 142, "Vốn (triệu USD)": 320 },
      { "Năm": 2022, "Lĩnh vực": "EdTech", "Số startup": 68, "Vốn (triệu USD)": 95 },
      { "Năm": 2023, "Lĩnh vực": "Fintech", "Số startup": 198, "Vốn (triệu USD)": 380 },
      { "Năm": 2023, "Lĩnh vực": "AI/ML", "Số startup": 85, "Vốn (triệu USD)": 210 },
      { "Năm": 2024, "Lĩnh vực": "AI/ML", "Số startup": 125, "Vốn (triệu USD)": 420 },
    ],
  },
  {
    id: "doanh-thu-it",
    title: "Doanh thu ngành CNTT",
    description: "Doanh thu phần mềm và dịch vụ CNTT (tỷ USD)",
    type: "technology",
    domain: "cong-nghe",
    raw_data: [
      { "Năm": 2019, "Phần mềm": 0.85, "Dịch vụ": 1.2, "Xuất khẩu": 3.5 },
      { "Năm": 2020, "Phần mềm": 0.95, "Dịch vụ": 1.4, "Xuất khẩu": 3.8 },
      { "Năm": 2021, "Phần mềm": 1.1, "Dịch vụ": 1.6, "Xuất khẩu": 4.2 },
      { "Năm": 2022, "Phần mềm": 1.35, "Dịch vụ": 1.9, "Xuất khẩu": 5.0 },
      { "Năm": 2023, "Phần mềm": 1.6, "Dịch vụ": 2.2, "Xuất khẩu": 5.8 },
      { "Năm": 2024, "Phần mềm": 1.9, "Dịch vụ": 2.5, "Xuất khẩu": 6.5 },
    ],
  },

  // === MÔI TRƯỜNG ===
  {
    id: "chat-luong-khong-khi",
    title: "Chất lượng không khí Hà Nội",
    description: "Chỉ số AQI trung bình theo tháng (2023-2024)",
    type: "environment",
    domain: "moi-truong",
    raw_data: [
      { "Tháng": "2023-01", "AQI trung bình": 185, "PM2.5 (µg/m³)": 85, "Ngày ô nhiễm nặng": 12 },
      { "Tháng": "2023-06", "AQI trung bình": 95, "PM2.5 (µg/m³)": 35, "Ngày ô nhiễm nặng": 2 },
      { "Tháng": "2023-12", "AQI trung bình": 165, "PM2.5 (µg/m³)": 72, "Ngày ô nhiễm nặng": 10 },
      { "Tháng": "2024-01", "AQI trung bình": 172, "PM2.5 (µg/m³)": 78, "Ngày ô nhiễm nặng": 11 },
      { "Tháng": "2024-03", "AQI trung bình": 125, "PM2.5 (µg/m³)": 48, "Ngày ô nhiễm nặng": 5 },
    ],
  },
  {
    id: "nang-luong-tai-tao",
    title: "Năng lượng tái tạo",
    description: "Công suất lắp đặt điện mặt trời, điện gió (MW)",
    type: "environment",
    domain: "moi-truong",
    raw_data: [
      { "Năm": 2019, "Điện mặt trời (MW)": 5800, "Điện gió (MW)": 330, "Tổng công suất (MW)": 54000 },
      { "Năm": 2021, "Điện mặt trời (MW)": 16500, "Điện gió (MW)": 850, "Tổng công suất (MW)": 78000 },
      { "Năm": 2023, "Điện mặt trời (MW)": 18500, "Điện gió (MW)": 4200, "Tổng công suất (MW)": 85000 },
      { "Năm": 2024, "Điện mặt trời (MW)": 19500, "Điện gió (MW)": 5500, "Tổng công suất (MW)": 92000 },
    ],
  },

  // === XÃ HỘI ===
  {
    id: "dan-so-vietnam",
    title: "Dân số Việt Nam",
    description: "Dân số và cơ cấu theo nhóm tuổi (triệu người)",
    type: "society",
    domain: "xa-hoi",
    raw_data: [
      { "Năm": 2019, "Tổng dân số": 96.2, "0-14 tuổi": 23.5, "15-64 tuổi": 66.5, "65+ tuổi": 6.2 },
      { "Năm": 2021, "Tổng dân số": 98.2, "0-14 tuổi": 22.8, "15-64 tuổi": 67.2, "65+ tuổi": 8.2 },
      { "Năm": 2023, "Tổng dân số": 100.3, "0-14 tuổi": 21.5, "15-64 tuổi": 67.8, "65+ tuổi": 10.0 },
      { "Năm": 2024, "Tổng dân số": 101.2, "0-14 tuổi": 21.0, "15-64 tuổi": 68.0, "65+ tuổi": 12.2 },
    ],
  },
  {
    id: "muc-song",
    title: "Thu nhập bình quân theo vùng",
    description: "Thu nhập bình quân đầu người/tháng (triệu VND)",
    type: "society",
    domain: "xa-hoi",
    raw_data: [
      { "Vùng": "Cả nước", "Thành thị": 6.5, "Nông thôn": 4.2, "Chênh lệch (lần)": 1.55 },
      { "Vùng": "Đông Nam Bộ", "Thành thị": 8.2, "Nông thôn": 5.8, "Chênh lệch (lần)": 1.41 },
      { "Vùng": "Đồng bằng sông Hồng", "Thành thị": 7.5, "Nông thôn": 4.8, "Chênh lệch (lần)": 1.56 },
      { "Vùng": "Tây Nguyên", "Thành thị": 5.2, "Nông thôn": 3.1, "Chênh lệch (lần)": 1.68 },
    ],
  },

  // === NÔNG NGHIỆP ===
  {
    id: "xuat-khau-nong-san",
    title: "Xuất khẩu nông sản",
    description: "Kim ngạch xuất khẩu các mặt hàng chủ lực (tỷ USD)",
    type: "agriculture",
    domain: "nong-nghiep",
    raw_data: [
      { "Năm": 2020, "Gạo": 3.1, "Cà phê": 2.7, "Cao su": 2.2, "Thủy sản": 8.4, "Rau quả": 3.3 },
      { "Năm": 2021, "Gạo": 3.2, "Cà phê": 3.0, "Cao su": 2.8, "Thủy sản": 8.9, "Rau quả": 3.6 },
      { "Năm": 2022, "Gạo": 3.5, "Cà phê": 3.9, "Cao su": 3.2, "Thủy sản": 10.8, "Rau quả": 3.4 },
      { "Năm": 2023, "Gạo": 4.8, "Cà phê": 4.2, "Cao su": 2.9, "Thủy sản": 9.2, "Rau quả": 5.6 },
      { "Năm": 2024, "Gạo": 4.5, "Cà phê": 4.5, "Cao su": 3.0, "Thủy sản": 9.8, "Rau quả": 6.2 },
    ],
  },
  {
    id: "nang-suat-lua",
    title: "Năng suất lúa theo vùng",
    description: "Năng suất lúa (tạ/ha) theo vùng sản xuất",
    type: "agriculture",
    domain: "nong-nghiep",
    raw_data: [
      { "Vùng": "Đồng bằng sông Cửu Long", "Năng suất (tạ/ha)": 62.5, "Diện tích (triệu ha)": 4.2 },
      { "Vùng": "Đồng bằng sông Hồng", "Năng suất (tạ/ha)": 58.2, "Diện tích (triệu ha)": 1.15 },
      { "Vùng": "Duyên hải Nam Trung Bộ", "Năng suất (tạ/ha)": 52.8, "Diện tích (triệu ha)": 0.85 },
      { "Vùng": "Bắc Trung Bộ", "Năng suất (tạ/ha)": 54.2, "Diện tích (triệu ha)": 0.72 },
    ],
  },

  // === KHÁC (Mẫu, thực nghiệm, phân tích) ===
  {
    id: "dataset-thuc-nghiem",
    title: "Dataset Thực nghiệm",
    description: "Dữ liệu từ các thực nghiệm nghiên cứu",
    type: "experiment",
    domain: "khac",
    raw_data: [
      { "Nhóm": "Đối chứng", "Trung bình": 45.2, "Độ lệch chuẩn": 5.1 },
      { "Nhóm": "Thí nghiệm 1", "Trung bình": 52.8, "Độ lệch chuẩn": 4.3 },
      { "Nhóm": "Thí nghiệm 2", "Trung bình": 58.1, "Độ lệch chuẩn": 5.8 },
      { "Nhóm": "Thí nghiệm 3", "Trung bình": 61.4, "Độ lệch chuẩn": 4.9 },
    ],
  },
  {
    id: "dataset-phan-tich",
    title: "Dataset Phân tích",
    description: "Dữ liệu đã được xử lý và phân tích",
    type: "processed",
    domain: "khac",
    raw_data: [
      { "Chỉ số": "Trung bình", "Giá trị": 72.5 },
      { "Chỉ số": "Độ lệch chuẩn", "Giá trị": 12.3 },
      { "Chỉ số": "Min", "Giá trị": 42 },
      { "Chỉ số": "Max", "Giá trị": 95 },
      { "Chỉ số": "Median", "Giá trị": 74 },
    ],
  },
]
