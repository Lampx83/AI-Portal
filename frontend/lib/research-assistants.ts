// lib/research-assistants.ts
// Frontend types và icon mapping - logic đã được chuyển sang backend
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
  type LucideIcon,
} from "lucide-react"

// Icon name mapping từ backend
export type IconName =
  | "Users"
  | "Database"
  | "ListTodo"
  | "ShieldCheck"
  | "Award"
  | "Newspaper"
  | "FileText"
  | "Bot"

// Map icon name từ backend sang LucideIcon component
const iconMap: Record<IconName, LucideIcon> = {
  Users,
  Database,
  ListTodo,
  ShieldCheck,
  Award,
  Newspaper,
  FileText,
  Bot,
}

/**
 * Convert icon name từ backend sang LucideIcon component
 */
export function getIconComponent(iconName: IconName): LucideIcon {
  return iconMap[iconName] || Bot // Default to Bot if not found
}

// Interface từ backend API response - chỉ config (không có metadata)
export interface ResearchAssistantConfigResponse {
  alias: string
  icon: IconName // Backend trả về icon name
  baseUrl: string
  domainUrl?: string
}

// Interface từ backend API response - có metadata đầy đủ
export interface ResearchAssistantResponse extends Partial<AgentMetadata> {
  alias: string
  icon: IconName // Backend trả về icon name
  baseUrl: string
  domainUrl?: string
  bgColor: string
  iconColor: string
  health: "healthy" | "unhealthy"
  name: string // Luôn có name (từ metadata hoặc alias)
}

// Interface cho frontend config (chỉ config, không có metadata)
export interface ResearchAssistantConfig extends Omit<ResearchAssistantConfigResponse, "icon"> {
  Icon: LucideIcon // Frontend sẽ map icon name sang Icon component
}

// Interface cho frontend (có Icon component và metadata đầy đủ)
export interface ResearchAssistant extends Omit<ResearchAssistantResponse, "icon"> {
  Icon: LucideIcon // Frontend sẽ map icon name sang Icon component
}

/**
 * Transform config từ API response sang format có Icon component
 */
export function transformConfig(
  config: ResearchAssistantConfigResponse
): ResearchAssistantConfig {
  return {
    ...config,
    Icon: getIconComponent(config.icon),
  }
}

/**
 * Transform assistant từ API response sang format có Icon component
 */
export function transformAssistant(
  assistant: ResearchAssistantResponse
): ResearchAssistant {
  return {
    ...assistant,
    Icon: getIconComponent(assistant.icon),
  }
}

// Export để backward compatibility - sẽ được thay thế bằng API calls
export const researchAssistants: ResearchAssistant[] = []
