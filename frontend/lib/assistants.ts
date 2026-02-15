// lib/assistants.ts – types và icon mapping cho trợ lý AI (AI Portal)
import type { AgentMetadata } from "@/lib/agent-types"
import {
  Users,
  Database,
  ListTodo,
  ShieldCheck,
  Award,
  Newspaper,
  FileText,
  Bot,
  MessageSquare,
  Brain,
  GraduationCap,
  type LucideIcon,
} from "lucide-react"

export type IconName =
  | "Bot"
  | "MessageSquare"
  | "Brain"
  | "Users"
  | "Database"
  | "ListTodo"
  | "ShieldCheck"
  | "Award"
  | "Newspaper"
  | "FileText"
  | "GraduationCap"

const iconMap: Record<IconName, LucideIcon> = {
  Bot,
  MessageSquare,
  Brain,
  Users,
  Database,
  ListTodo,
  ShieldCheck,
  Award,
  Newspaper,
  FileText,
  GraduationCap,
}

export const AGENT_ICON_OPTIONS: IconName[] = [
  "Bot",
  "MessageSquare",
  "Brain",
  "Users",
  "FileText",
  "Database",
  "ListTodo",
  "ShieldCheck",
  "Award",
  "Newspaper",
  "GraduationCap",
]

export function getIconComponent(iconName: IconName): LucideIcon {
  return iconMap[iconName] || Bot
}

export interface AssistantConfigResponse {
  alias: string
  icon: IconName
  baseUrl: string
  domainUrl?: string
}

export interface AssistantResponse extends Partial<AgentMetadata> {
  alias: string
  icon: IconName
  baseUrl: string
  domainUrl?: string
  bgColor: string
  iconColor: string
  health: "healthy" | "unhealthy"
  name: string
}

export interface AssistantConfig extends Omit<AssistantConfigResponse, "icon"> {
  Icon: LucideIcon
}

export interface Assistant extends Omit<AssistantResponse, "icon"> {
  Icon: LucideIcon
}

export function transformConfig(config: AssistantConfigResponse): AssistantConfig {
  return {
    ...config,
    Icon: getIconComponent(config.icon),
  }
}

export function transformAssistant(assistant: AssistantResponse): Assistant {
  return {
    ...assistant,
    Icon: getIconComponent(assistant.icon),
  }
}

export const assistants: Assistant[] = []

/** Fallback cho công cụ (write, data) khi API chưa trả về — luôn hiển thị mục Công cụ */
const APP_FALLBACKS: Record<string, { name: string; icon: IconName; bgColor: string; iconColor: string }> = {
  write: {
    name: "Viết bài",
    icon: "FileText",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  data: {
    name: "Trợ lý Dữ liệu",
    icon: "Database",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    iconColor: "text-cyan-600 dark:text-cyan-400",
  },
}

export function getAppFallbackAssistant(alias: string): Assistant | null {
  const fallback = APP_FALLBACKS[alias]
  if (!fallback) return null
  return {
    alias,
    name: fallback.name,
    health: "unhealthy",
    Icon: getIconComponent(fallback.icon),
    bgColor: fallback.bgColor,
    iconColor: fallback.iconColor,
    baseUrl: "",
  }
}
