"use client";

import { useState, useEffect, useMemo } from "react";
import { researchAssistantConfigs, getResearchAssistant, type ResearchAssistant } from "@/lib/research-assistants";

/**
 * Hook để fetch và cache danh sách tất cả các trợ lý với metadata từ API
 */
export function useResearchAssistants() {
  const [assistants, setAssistants] = useState<ResearchAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAssistants() {
      try {
        setLoading(true);
        setError(null);

        // Fetch từng assistant riêng lẻ để nếu một cái fail thì không ảnh hưởng các cái khác
        const fetchedAssistants = await Promise.allSettled(
          researchAssistantConfigs.map((config) => getResearchAssistant(config))
        );

        // Lấy tất cả assistants (kể cả unhealthy) - getResearchAssistant luôn trả về một object
        const allAssistants = fetchedAssistants
          .filter((result): result is PromiseFulfilledResult<ResearchAssistant> => 
            result.status === "fulfilled"
          )
          .map((result) => result.value);

        // Log để debug
        console.log("📋 Fetched assistants:", {
          total: allAssistants.length,
          configs: researchAssistantConfigs.length,
          assistants: allAssistants.map(a => ({ alias: a.alias, name: a.name, health: a.health })),
          rejected: fetchedAssistants.filter(r => r.status === "rejected").length,
        });

        if (!cancelled) {
          setAssistants(allAssistants);
          // Chỉ set error nếu tất cả đều fail
          if (allAssistants.length === 0 && fetchedAssistants.length > 0) {
            setError(new Error("Không thể tải được thông tin trợ lý nào"));
          }
        }
      } catch (err) {
        // Catch mọi lỗi không mong đợi
        if (!cancelled) {
          console.error("Unexpected error in fetchAssistants:", err);
          setError(err instanceof Error ? err : new Error("Failed to fetch assistants"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAssistants();

    return () => {
      cancelled = true;
    };
  }, []);

  return { assistants, loading, error };
}

/**
 * Hook để fetch một trợ lý theo alias với metadata từ API
 */
export function useResearchAssistant(alias: string | null) {
  const [assistant, setAssistant] = useState<ResearchAssistant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!alias) {
      setAssistant(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAssistant() {
      try {
        setLoading(true);
        setError(null);

        const config = researchAssistantConfigs.find((c) => c.alias === alias);
        if (!config) {
          if (!cancelled) {
            setAssistant(null);
            setLoading(false);
          }
          return;
        }

        const fetchedAssistant = await getResearchAssistant(config);
        if (!cancelled) {
          setAssistant(fetchedAssistant);
          // Nếu trợ lý unhealthy, set error để thông báo
          if (fetchedAssistant.health === "unhealthy") {
            setError(new Error(`Trợ lý ${alias} hiện không khả dụng`));
          }
        }
      } catch (err) {
        // Catch mọi lỗi và không throw
        if (!cancelled) {
          console.error(`Error fetching assistant ${alias}:`, err);
          setError(err instanceof Error ? err : new Error("Failed to fetch assistant"));
          setAssistant(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAssistant();

    return () => {
      cancelled = true;
    };
  }, [alias]);

  return { assistant, loading, error };
}
