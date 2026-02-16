export type RawDataRow = Record<string, string | number>
export type ChartType = "bar" | "pie" | "line" | "area" | "radar" | "composed" | "scatter"
export type Dataset = {
  id: string
  title: string
  description?: string
  type?: string
  domain?: string
  raw_data?: RawDataRow[]
  sheets?: Record<string, RawDataRow[]>
  chart_types?: ChartType[]
}
export type DomainInfo = {
  id: string
  name: string
  description: string
  order: number
  dataset_count: number
}
export type ProjectFileItem = { key: string; name: string; url: string }
