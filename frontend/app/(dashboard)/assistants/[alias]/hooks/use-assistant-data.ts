"use client";

import { useEffect, useMemo, useState } from "react";

export type DataTypeOption = { type: string; label: string };

export function useAssistantData(
  assistant: {
    alias?: string;
    baseUrl?: string;
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
        const urls = [
          `${assistant.baseUrl}/data?type=${encodeURIComponent(activeType)}`,
          `${assistant.baseUrl}/v1/data?type=${encodeURIComponent(activeType)}`,
        ];

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
  }, [assistant?.baseUrl, activeType]);

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
