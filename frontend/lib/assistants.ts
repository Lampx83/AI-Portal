// lib/assistants.ts – types and icon mapping for AI assistants (AI Portal)
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
  Sparkles,
  BookOpen,
  Search,
  Code,
  Calculator,
  Image,
  Music,
  Video,
  Mail,
  Phone,
  MapPin,
  BarChart2,
  Settings,
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
  | "Sparkles"
  | "BookOpen"
  | "Search"
  | "Code"
  | "Calculator"
  | "Image"
  | "Music"
  | "Video"
  | "Mail"
  | "Phone"
  | "MapPin"
  | "BarChart2"
  | "Settings"

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
  Sparkles,
  BookOpen,
  Search,
  Code,
  Calculator,
  Image,
  Music,
  Video,
  Mail,
  Phone,
  MapPin,
  BarChart2,
  Settings,
}

export const AGENT_ICON_OPTIONS: IconName[] = [
  "Bot",
  "MessageSquare",
  "Brain",
  "Sparkles",
  "Users",
  "GraduationCap",
  "BookOpen",
  "FileText",
  "Database",
  "ListTodo",
  "ShieldCheck",
  "Award",
  "Newspaper",
  "Search",
  "Code",
  "Calculator",
  "Image",
  "Music",
  "Video",
  "Mail",
  "Phone",
  "MapPin",
  "BarChart2",
  "Settings",
]

export function getIconComponent(iconName: IconName): LucideIcon {
  return iconMap[iconName] || Bot
}

export interface AssistantConfigResponse {
  alias: string
  icon: IconName
  baseUrl: string
}

export interface AssistantResponse extends Partial<AgentMetadata> {
  alias: string
  icon: IconName
  baseUrl: string
  bgColor: string
  iconColor: string
  health: "healthy" | "unhealthy"
  name: string
  config_json?: Record<string, unknown>
}

export interface AssistantConfig extends Omit<AssistantConfigResponse, "icon"> {
  Icon: LucideIcon
}

export interface Assistant extends Omit<AssistantResponse, "icon"> {
  Icon: LucideIcon
  config_json?: Record<string, unknown>
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

