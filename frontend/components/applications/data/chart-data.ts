import type { Dataset, RawDataRow } from "./types"

/** Dữ liệu mẫu phong phú theo từng loại dataset */
export function getDatasetChartData(dataset: Dataset) {
  const type = (dataset.type ?? "").toLowerCase()
  const id = dataset.id

  if (type.includes("survey") || id.includes("survey")) {
    return {
      bar: [
        { category: "Rất hài lòng", count: 125, percent: 42 },
        { category: "Hài lòng", count: 98, percent: 33 },
        { category: "Bình thường", count: 45, percent: 15 },
        { category: "Không hài lòng", count: 22, percent: 7 },
        { category: "Rất không hài lòng", count: 10, percent: 3 },
      ],
      pie: [
        { name: "Khoa CNTT", value: 85 },
        { name: "Khoa KT", value: 72 },
        { name: "Khoa NN", value: 58 },
        { name: "Khoa KHXH", value: 45 },
        { name: "Khác", value: 40 },
      ],
      line: [
        { month: "T1", score: 3.2, target: 3.5 },
        { month: "T2", score: 3.4, target: 3.6 },
        { month: "T3", score: 3.5, target: 3.7 },
        { month: "T4", score: 3.8, target: 3.8 },
        { month: "T5", score: 4.0, target: 3.9 },
        { month: "T6", score: 3.9, target: 4.0 },
      ],
      radar: [
        { subject: "Chất lượng", value: 85, fullMark: 100 },
        { subject: "Cơ sở vật chất", value: 72, fullMark: 100 },
        { subject: "Giảng viên", value: 90, fullMark: 100 },
        { subject: "Chương trình", value: 78, fullMark: 100 },
        { subject: "Hỗ trợ", value: 65, fullMark: 100 },
      ],
      scatter: [
        { x: 1, y: 3.2 },
        { x: 2, y: 3.8 },
        { x: 3, y: 4.1 },
        { x: 4, y: 3.5 },
        { x: 5, y: 4.2 },
        { x: 6, y: 3.9 },
      ],
    }
  }

  if (type.includes("experiment") || id.includes("experiment")) {
    return {
      bar: [
        { category: "Nhóm đối chứng", mean: 45.2, std: 5.1 },
        { category: "Nhóm thí nghiệm 1", mean: 52.8, std: 4.3 },
        { category: "Nhóm thí nghiệm 2", mean: 58.1, std: 5.8 },
        { category: "Nhóm thí nghiệm 3", mean: 61.4, std: 4.9 },
      ],
      pie: [
        { name: "Thành công", value: 68 },
        { name: "Một phần", value: 22 },
        { name: "Không đạt", value: 10 },
      ],
      line: [
        { time: "0h", value: 0, baseline: 5 },
        { time: "2h", value: 12, baseline: 15 },
        { time: "4h", value: 28, baseline: 25 },
        { time: "6h", value: 45, baseline: 40 },
        { time: "8h", value: 62, baseline: 55 },
        { time: "10h", value: 78, baseline: 70 },
        { time: "12h", value: 85, baseline: 80 },
      ],
      radar: [
        { subject: "Độ chính xác", value: 92, fullMark: 100 },
        { subject: "Độ lặp lại", value: 88, fullMark: 100 },
        { subject: "Độ ổn định", value: 75, fullMark: 100 },
        { subject: "Tốc độ", value: 85, fullMark: 100 },
        { subject: "Hiệu suất", value: 78, fullMark: 100 },
      ],
      scatter: [
        { x: 10, y: 45 },
        { x: 20, y: 52 },
        { x: 30, y: 58 },
        { x: 40, y: 65 },
        { x: 50, y: 72 },
      ],
    }
  }

  if (type.includes("health") || id.includes("dich-te") || id.includes("chi-phi-y-te")) {
    const raw = dataset.raw_data ?? []
    const first = raw[0] as RawDataRow | undefined
    const catKey = first
      ? (Object.keys(first).find((k) =>
          ["Tháng", "Vùng", "Ngành"].some((x) => k.includes(x))
        ) ?? Object.keys(first)[0])
      : "category"
    const valKey = first
      ? (Object.keys(first).find((k) =>
          ["Ca mắc", "Chi phí", "Số lượng", "Giá trị"].some((x) => k.includes(x))
        ) ?? Object.keys(first).filter((k) => k !== catKey)[0])
      : "value"
    return {
      bar: raw.map((r: RawDataRow) => ({
        category: String(r[catKey] ?? ""),
        value: r[valKey] ?? 0,
        ...r,
      })),
      pie: raw
        .slice(0, 6)
        .map((r: RawDataRow) => ({
          name: String(r[catKey] ?? ""),
          value: Number(r[valKey] ?? 0),
        })),
      line: raw.map((r: RawDataRow) => ({
        period: String(r[catKey] ?? ""),
        value: r[valKey] ?? 0,
        ...r,
      })),
      radar: raw
        .slice(0, 5)
        .map((r: RawDataRow) => ({
          subject: String(r[catKey] ?? ""),
          value: Number(r[valKey] ?? 0),
          fullMark: 100,
        })),
      scatter: raw.map((r: RawDataRow, i) => ({
        x: i + 1,
        y: Number(r[valKey] ?? 0),
      })),
    }
  }

  if (
    type.includes("excel") ||
    type.includes("technology") ||
    type.includes("environment") ||
    type.includes("society") ||
    type.includes("agriculture") ||
    id.includes("fdi") ||
    id.includes("lam-phat") ||
    id.includes("startup") ||
    id.includes("doanh-thu") ||
    id.includes("chat-luong") ||
    id.includes("nang-luong") ||
    id.includes("dan-so") ||
    id.includes("muc-song") ||
    id.includes("xuat-khau") ||
    id.includes("nang-suat")
  ) {
    const raw = dataset.raw_data ?? []
    const first = raw[0] as RawDataRow | undefined
    const catKey = first
      ? (Object.keys(first).find((k) =>
          ["Năm", "Tháng", "Vùng", "Lĩnh vực", "Ngành"].some((x) => k.includes(x))
        ) ?? Object.keys(first)[0])
      : "category"
    const valKeys = first
      ? Object.keys(first).filter((k) => k !== catKey && typeof (first as any)[k] === "number")
      : []
    const valKey = valKeys[0] ?? "value"
    return {
      bar: raw.map((r: RawDataRow) => ({
        category: String(r[catKey] ?? ""),
        value: r[valKey] ?? 0,
        ...r,
      })),
      pie: raw
        .slice(0, 6)
        .map((r: RawDataRow) => ({
          name: String(r[catKey] ?? ""),
          value: Number(r[valKey] ?? 0),
        })),
      line: raw.map((r: RawDataRow) => ({
        period: String(r[catKey] ?? ""),
        value: r[valKey] ?? 0,
        ...r,
      })),
      radar: raw
        .slice(0, 5)
        .map((r: RawDataRow) => ({
          subject: String(r[catKey] ?? "").slice(0, 12),
          value: Number(r[valKey] ?? 0),
          fullMark: 100,
        })),
      scatter: raw.map((r: RawDataRow, i) => ({ x: i + 1, y: Number(r[valKey] ?? 0) })),
    }
  }

  if (
    (type.includes("macro") || id.includes("macro-vn")) &&
    dataset.raw_data?.[0]?.["Tăng trưởng GDP (%)"] != null
  ) {
    const raw = dataset.raw_data ?? []
    const barData =
      raw.length > 0
        ? raw.map((r: RawDataRow) => ({
            category: `${r["Năm"]} ${r["Quý"] ?? ""}`.trim(),
            "Tăng trưởng GDP (%)": r["Tăng trưởng GDP (%)"],
            "Lạm phát (%)": r["Lạm phát (%)"],
            "Thất nghiệp (%)": r["Thất nghiệp (%)"],
            "Lãi suất (%)": r["Lãi suất cơ bản (%)"],
          }))
        : []
    const lineData =
      raw.length > 0
        ? raw.map((r: RawDataRow) => ({
            period: `${r["Năm"]} ${r["Quý"]}`,
            "GDP (%)": r["Tăng trưởng GDP (%)"],
            "Lạm phát (%)": r["Lạm phát (%)"],
            "Xuất khẩu": r["Xuất khẩu (tỷ USD)"],
            "Nhập khẩu": r["Nhập khẩu (tỷ USD)"],
            "Cán cân TM": r["Cán cân TM (tỷ USD)"],
          }))
        : []
    const pieData =
      raw.length > 0
        ? [
            {
              name: "GDP tăng trưởng dương",
              value:
                raw.filter((r: RawDataRow) => (r["Tăng trưởng GDP (%)"] as number) > 0).length * 5,
            },
            {
              name: "GDP tăng trưởng âm",
              value:
                raw.filter((r: RawDataRow) => (r["Tăng trưởng GDP (%)"] as number) <= 0).length * 5,
            },
            {
              name: "Lạm phát trên 3%",
              value: raw.filter((r: RawDataRow) => (r["Lạm phát (%)"] as number) > 3).length * 5,
            },
            {
              name: "Lạm phát dưới 3%",
              value: raw.filter((r: RawDataRow) => (r["Lạm phát (%)"] as number) <= 3).length * 5,
            },
          ].filter((d) => d.value > 0)
        : [{ name: "N/A", value: 1 }]
    return {
      bar:
        barData.length > 0
          ? barData.slice(-12)
          : [{ category: "N/A", "Tăng trưởng GDP (%)": 0 }],
      pie: pieData.length > 0 ? pieData : [{ name: "N/A", value: 1 }],
      line:
        lineData.length > 0 ? lineData : [{ period: "N/A", "GDP (%)": 0 }],
      radar: [
        {
          subject: "Tăng trưởng GDP",
          value: Math.min(
            100,
            Math.max(0, ((raw[raw.length - 1]?.["Tăng trưởng GDP (%)"] as number) ?? 0) * 10)
          ),
          fullMark: 100,
        },
        {
          subject: "Kiểm soát lạm phát",
          value: Math.min(
            100,
            Math.max(
              0,
              100 - ((raw[raw.length - 1]?.["Lạm phát (%)"] as number) ?? 0) * 15
            )
          ),
          fullMark: 100,
        },
        {
          subject: "Việc làm",
          value: Math.min(
            100,
            Math.max(
              0,
              100 - ((raw[raw.length - 1]?.["Thất nghiệp (%)"] as number) ?? 0) * 25
            )
          ),
          fullMark: 100,
        },
        {
          subject: "Xuất khẩu",
          value: Math.min(
            100,
            ((raw[raw.length - 1]?.["Xuất khẩu (tỷ USD)"] as number) ?? 0) / 1.5
          ),
          fullMark: 100,
        },
        {
          subject: "Cán cân TM",
          value: Math.min(
            100,
            Math.max(
              0,
              50 + ((raw[raw.length - 1]?.["Cán cân TM (tỷ USD)"] as number) ?? 0) * 3
            )
          ),
          fullMark: 100,
        },
      ],
      scatter:
        raw.length > 0
          ? raw.map((r: RawDataRow, i: number) => ({
              x: i + 1,
              y: r["Tăng trưởng GDP (%)"] as number,
              z: r["Lạm phát (%)"] as number,
            }))
          : [{ x: 1, y: 0 }],
    }
  }

  if (
    type.includes("processed") ||
    type.includes("descriptive") ||
    type.includes("correlation")
  ) {
    return {
      bar: [
        { metric: "Trung bình", value: 72.5 },
        { metric: "Độ lệch chuẩn", value: 12.3 },
        { metric: "Min", value: 42 },
        { metric: "Max", value: 95 },
        { metric: "Median", value: 74 },
      ],
      pie: [
        { name: "Tương quan mạnh", value: 35 },
        { name: "Tương quan TB", value: 45 },
        { name: "Tương quan yếu", value: 20 },
      ],
      line: [
        { period: "Q1", metric1: 65, metric2: 58 },
        { period: "Q2", metric1: 72, metric2: 68 },
        { period: "Q3", metric1: 78, metric2: 75 },
        { period: "Q4", metric1: 82, metric2: 80 },
      ],
      radar: [
        { subject: "A", value: 65, fullMark: 100 },
        { subject: "B", value: 78, fullMark: 100 },
        { subject: "C", value: 72, fullMark: 100 },
        { subject: "D", value: 85, fullMark: 100 },
        { subject: "E", value: 90, fullMark: 100 },
      ],
      scatter: [
        { x: 50, y: 55 },
        { x: 60, y: 62 },
        { x: 70, y: 68 },
        { x: 80, y: 75 },
        { x: 90, y: 82 },
      ],
    }
  }

  return {
    bar: [
      { name: "Nhóm A", value: 400 },
      { name: "Nhóm B", value: 300 },
      { name: "Nhóm C", value: 200 },
      { name: "Nhóm D", value: 278 },
      { name: "Nhóm E", value: 189 },
    ],
    pie: [
      { name: "A", value: 400 },
      { name: "B", value: 300 },
      { name: "C", value: 200 },
      { name: "D", value: 278 },
    ],
    line: [
      { x: "1", metric1: 40, metric2: 35 },
      { x: "2", metric1: 55, metric2: 50 },
      { x: "3", metric1: 48, metric2: 52 },
      { x: "4", metric1: 72, metric2: 65 },
      { x: "5", metric1: 65, metric2: 70 },
    ],
    radar: [
      { subject: "X", value: 70, fullMark: 100 },
      { subject: "Y", value: 80, fullMark: 100 },
      { subject: "Z", value: 60, fullMark: 100 },
    ],
    scatter: [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 3 },
      { x: 4, y: 5 },
    ],
  }
}
