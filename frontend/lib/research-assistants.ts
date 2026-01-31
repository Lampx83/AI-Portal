// data/research-assisstants.ts
import type { AgentMetadata } from "@/lib/agent-types";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  Database,
  ListTodo,
  ShieldCheck,
  Award,
  Newspaper,
  FileText,
  Bot,
} from "lucide-react";
import { API_CONFIG } from "@/lib/config";
const baseUrl = API_CONFIG.baseUrl;

// Danh sách màu sắc đa dạng cho icon và background
const colorPalettes = [
  { bgColor: "bg-blue-100 dark:bg-blue-900/30", iconColor: "text-blue-600 dark:text-blue-400" },
  { bgColor: "bg-cyan-100 dark:bg-cyan-900/30", iconColor: "text-cyan-600 dark:text-cyan-400" },
  { bgColor: "bg-purple-100 dark:bg-purple-900/30", iconColor: "text-purple-600 dark:text-purple-400" },
  { bgColor: "bg-pink-100 dark:bg-pink-900/30", iconColor: "text-pink-600 dark:text-pink-400" },
  { bgColor: "bg-indigo-100 dark:bg-indigo-900/30", iconColor: "text-indigo-600 dark:text-indigo-400" },
  { bgColor: "bg-emerald-100 dark:bg-emerald-900/30", iconColor: "text-emerald-600 dark:text-emerald-400" },
  { bgColor: "bg-amber-100 dark:bg-amber-900/30", iconColor: "text-amber-600 dark:text-amber-400" },
  { bgColor: "bg-orange-100 dark:bg-orange-900/30", iconColor: "text-orange-600 dark:text-orange-400" },
  { bgColor: "bg-teal-100 dark:bg-teal-900/30", iconColor: "text-teal-600 dark:text-teal-400" },
  { bgColor: "bg-rose-100 dark:bg-rose-900/30", iconColor: "text-rose-600 dark:text-rose-400" },
  { bgColor: "bg-violet-100 dark:bg-violet-900/30", iconColor: "text-violet-600 dark:text-violet-400" },
  { bgColor: "bg-sky-100 dark:bg-sky-900/30", iconColor: "text-sky-600 dark:text-sky-400" },
];

/**
 * Lấy màu sắc dựa trên alias để đảm bảo nhất quán
 */
function getColorForAlias(alias: string): { bgColor: string; iconColor: string } {
  // Tạo hash từ alias để luôn trả về cùng màu cho cùng alias
  let hash = 0;
  for (let i = 0; i < alias.length; i++) {
    hash = alias.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorPalettes.length;
  return colorPalettes[index];
}

// Cấu hình tối thiểu cho mỗi trợ lý - chỉ giữ thông tin cần thiết cho UI
export interface ResearchAssistantConfig {
  alias: string;
  Icon: LucideIcon;
  baseUrl: string;
  domainUrl?: string;
}

// Interface đầy đủ sau khi merge với metadata từ API
export interface ResearchAssistant extends Partial<AgentMetadata> {
  alias: string;
  Icon: LucideIcon;
  baseUrl: string;
  domainUrl?: string;
  bgColor: string;
  iconColor: string;
  health: "healthy" | "unhealthy";
  name: string; // Luôn có name (từ metadata hoặc alias)
}

// Danh sách cấu hình tối thiểu các trợ lý
export const researchAssistantConfigs: ResearchAssistantConfig[] = [
  {
    alias: "main",
    Icon: Users,
    baseUrl: `${baseUrl}/api/main_agent/v1`,
  },
  {
    alias: "documents",
    Icon: FileText,
    baseUrl: process.env.NEXT_PUBLIC_PAPER_AGENT_URL || "http://localhost:8000/v1",
    domainUrl: "https://research.neu.edu.vn/api/agents/documents",
  },
  {
    alias: "experts",
    Icon: Users,
    baseUrl: process.env.NEXT_PUBLIC_EXPERT_AGENT_URL || "http://localhost:8011/v1",
    domainUrl: "https://research.neu.edu.vn/api/agents/experts",
  },
  {
    alias: "write",
    Icon: FileText,
    baseUrl: `${baseUrl}/api/write_agent/v1`,
  },
  {
    alias: "data",
    Icon: Database,
    baseUrl: `${baseUrl}/api/data_agent/v1`,
  },
  {
    alias: "review",
    Icon: ListTodo,
    baseUrl: "http://localhost:8007/api/v1",
    domainUrl: "https://research.neu.edu.vn/api/agents/review",
  },
  {
    alias: "publish",
    Icon: Newspaper,
    baseUrl: "https://publication.neuresearch.workers.dev/v1",
  },
  {
    alias: "funds",
    Icon: Award,
    baseUrl: "https://fund.neuresearch.workers.dev/v1",
  },
  {
    alias: "plagiarism",
    Icon: ShieldCheck,
    baseUrl: "http://10.2.13.53:8002/api/file-search/ai",
  },
  {
    alias: "kcntt",
    Icon: Bot,
    baseUrl: "http://localhost:8010/v1",
    domainUrl: "https://fit.neu.edu.vn/ai-api/v1",
  },
];

// Cache metadata trong memory để tránh fetch nhiều lần
const metadataCache = new Map<string, { data: AgentMetadata; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 phút

/**
 * Validate metadata format - linh hoạt hơn, chỉ cần là object hợp lệ
 */
function isValidMetadata(data: any): data is AgentMetadata {
  if (!data || typeof data !== "object") return false;
  // Không yêu cầu name vì có thể dùng alias làm name mặc định
  return true;
}

/**
 * Fetch metadata từ API endpoint của trợ lý
 */
export async function fetchAssistantMetadata(baseUrl: string): Promise<AgentMetadata | null> {
  try {
    // Kiểm tra cache
    const cached = metadataCache.get(baseUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    const metadataUrl = `${baseUrl}/metadata`;
    
    // Wrap fetch với timeout và error handling tốt hơn
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 giây timeout

    try {
      const response = await fetch(metadataUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "default",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch metadata from ${metadataUrl}: ${response.status} ${response.statusText}`);
        return null;
      }

      const metadata = await response.json();
      
      console.log(`✅ Fetched metadata from ${metadataUrl}:`, metadata);
      
      // Validate metadata format
      if (!isValidMetadata(metadata)) {
        console.warn(`⚠️ Invalid metadata format from ${metadataUrl}:`, metadata);
        return null;
      }

      const agentMetadata = metadata as AgentMetadata;

      // Lưu vào cache
      metadataCache.set(baseUrl, {
        data: agentMetadata,
        timestamp: Date.now(),
      });

      return agentMetadata;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Không log lỗi nếu là abort (timeout) hoặc network error thông thường
      if (fetchError.name === "AbortError") {
        console.warn(`⚠️ Timeout fetching metadata from ${metadataUrl}`);
      } else if (fetchError.name === "TypeError" && fetchError.message.includes("Failed to fetch")) {
        console.warn(`⚠️ Network error fetching metadata from ${metadataUrl}:`, fetchError.message);
      } else {
        console.warn(`⚠️ Error fetching metadata from ${metadataUrl}:`, fetchError.message || fetchError);
      }
      return null;
    }
  } catch (error: any) {
    // Catch mọi lỗi khác và không throw
    console.warn(`⚠️ Unexpected error fetching metadata from ${baseUrl}/metadata:`, error?.message || error);
    return null;
  }
}

/**
 * Merge cấu hình với metadata từ API để tạo ResearchAssistant đầy đủ
 * Luôn trả về assistant, đánh dấu health là "unhealthy" nếu không fetch được metadata
 */
export async function getResearchAssistant(
  config: ResearchAssistantConfig
): Promise<ResearchAssistant> {
  try {
    const metadata = await fetchAssistantMetadata(config.baseUrl);
    
    // Lấy màu sắc dựa trên alias
    const colors = getColorForAlias(config.alias);

    // Nếu không fetch được metadata hoặc metadata không hợp lệ, trả về assistant với health unhealthy
    if (!metadata || !isValidMetadata(metadata)) {
      console.warn(`⚠️ Assistant ${config.alias} is unhealthy: failed to fetch or invalid metadata`);
      return {
        alias: config.alias,
        Icon: config.Icon,
        baseUrl: config.baseUrl,
        domainUrl: config.domainUrl,
        name: config.alias, // Dùng alias làm name mặc định
        health: "unhealthy",
        ...colors,
      };
    }

    // Normalize metadata: đảm bảo có name (dùng alias nếu không có)
    const normalizedMetadata: AgentMetadata = {
      ...metadata,
      name: metadata.name || config.alias,
      // Normalize provided_data_types: chuyển "detail" thành "description" nếu cần
      provided_data_types: metadata.provided_data_types?.map((dt: any) => ({
        type: dt.type,
        description: dt.description || dt.detail || undefined,
      })),
    };

    console.log(`✅ Merged assistant ${config.alias}:`, {
      name: normalizedMetadata.name,
      hasDescription: !!normalizedMetadata.description,
      hasCapabilities: !!normalizedMetadata.capabilities?.length,
      hasModels: !!normalizedMetadata.supported_models?.length,
      baseUrl: config.baseUrl,
      colors,
      health: "healthy",
    });

    return {
      ...normalizedMetadata,
      ...config,
      ...colors,
      health: "healthy",
      name: normalizedMetadata.name, // Đảm bảo name luôn có
    };
  } catch (error: any) {
    // Catch mọi lỗi và trả về assistant với health unhealthy
    console.warn(`⚠️ Assistant ${config.alias} is unhealthy:`, error?.message || error);
    const colors = getColorForAlias(config.alias);
    return {
      alias: config.alias,
      Icon: config.Icon,
      baseUrl: config.baseUrl,
      domainUrl: config.domainUrl,
      name: config.alias,
      health: "unhealthy",
      ...colors,
    };
  }
}

/**
 * Lấy tất cả các trợ lý với metadata từ API (bao gồm cả những trợ lý unhealthy)
 */
export async function getAllResearchAssistants(): Promise<ResearchAssistant[]> {
  const assistants = await Promise.all(
    researchAssistantConfigs.map((config) => getResearchAssistant(config))
  );
  
  return assistants; // Không filter, trả về tất cả kể cả unhealthy
}

/**
 * Lấy một trợ lý theo alias với metadata từ API
 */
export async function getResearchAssistantByAlias(
  alias: string
): Promise<ResearchAssistant | null> {
  const config = researchAssistantConfigs.find((c) => c.alias === alias);
  if (!config) return null;
  
  return getResearchAssistant(config);
}

// Export để backward compatibility - sẽ được thay thế bằng getAllResearchAssistants()
export const researchAssistants: ResearchAssistant[] = [];
