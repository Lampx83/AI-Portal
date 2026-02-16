"use client";

import { useEffect, useMemo, useState } from "react";
import { API_CONFIG } from "@/lib/config";

const baseUrl = API_CONFIG.baseUrl;

export type DataTypeOption = { type: string; label: string };

export function useAssistantData(
  assistant: {
    alias?: string;
    baseUrl?: string;
    domainUrl?: string;
    provided_data_types?: { type: string; label?: string }[];
  } | null,
  initialActiveType?: string
) {
  const dataTypes = useMemo<DataTypeOption[]>(
    () =>
      (assistant?.provided_data_types ?? []).map((d) => ({
        type: d.type,
        label: d.label ?? d.type,
      })),
    [assistant?.alias]
  );

  const [activeType, setActiveType] = useState<string>(
    () => initialActiveType ?? dataTypes?.[0]?.type ?? ""
  );
  const [isLoading, setIsLoading] = useState(true);
  const [itemsByType, setItemsByType] = useState<Record<string, any[]>>({});
  const [loadingByType, setLoadingByType] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!assistant) return;
    setItemsByType({});
    setLoadingByType({});
    setActiveType(initialActiveType ?? dataTypes?.[0]?.type ?? "");
    setIsLoading(true);
  }, [assistant?.alias, dataTypes, initialActiveType]);

  useEffect(() => {
    if (!assistant || !activeType) {
      setIsLoading(false);
      return;
    }
    if (itemsByType[activeType]) {
      setIsLoading(false);
      return;
    }

    const run = async () => {
      setIsLoading(true);
      setLoadingByType((m) => ({ ...m, [activeType]: true }));
      try {
        let urls: string[] = [];
        if (assistant.domainUrl) {
          let proxyUrl = assistant.domainUrl;
          if (proxyUrl.startsWith("/")) {
            proxyUrl = `${baseUrl}${proxyUrl}`;
          } else if (proxyUrl.startsWith("http://") || proxyUrl.startsWith("https://")) {
            if (process.env.NODE_ENV === "development" && proxyUrl.includes("portal.neu.edu.vn")) {
              try {
                const urlObj = new URL(proxyUrl);
                proxyUrl = `${baseUrl}${urlObj.pathname}`;
              } catch {
                const pathMatch = proxyUrl.match(/https?:\/\/[^/]+(\/.*)/);
                if (pathMatch) proxyUrl = `${baseUrl}${pathMatch[1]}`;
              }
            }
          } else {
            proxyUrl = `${baseUrl}/${proxyUrl}`;
          }
          urls = [`${proxyUrl}?type=${encodeURIComponent(activeType)}`];
        } else {
          urls = [
            `${assistant.baseUrl}/data?type=${encodeURIComponent(activeType)}`,
            `${assistant.baseUrl}/v1/data?type=${encodeURIComponent(activeType)}`,
          ];
        }

        let success = false;
        for (const testUrl of urls) {
          try {
            const res = await fetch(testUrl);
            if (!res.ok) {
              console.warn(`Data endpoint returned ${res.status}: ${testUrl}`);
              continue;
            }
            const json = await res.json();
            const items = Array.isArray(json?.items) ? json.items : [];
            setItemsByType((m) => ({ ...m, [activeType]: items }));
            success = true;
            break;
          } catch (e: any) {
            console.warn(`Failed to fetch from ${testUrl}:`, e?.message ?? e);
          }
        }
        if (!success) {
          setItemsByType((m) => ({ ...m, [activeType]: [] }));
        }
      } catch (e) {
        console.error("Error fetching data:", e);
        setItemsByType((m) => ({ ...m, [activeType]: [] }));
      } finally {
        setIsLoading(false);
        setLoadingByType((m) => ({ ...m, [activeType]: false }));
      }
    };
    run();
  }, [assistant?.baseUrl, assistant?.domainUrl, activeType]);

  return {
    dataTypes,
    activeType,
    setActiveType,
    isLoading,
    itemsByType,
    loadingByType,
    setItemsByType,
    setLoadingByType,
    setIsLoading,
  };
}
