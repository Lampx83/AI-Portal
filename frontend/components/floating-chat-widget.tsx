"use client";

import { useState, useMemo, useEffect } from "react";
import { Bot, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResearchAssistants } from "@/hooks/use-research-assistants";
import type { ResearchAssistant } from "@/lib/research-assistants";

const FLOATING_CHAT_ALIASES = ["data"] as const;
export type FloatingChatAlias = (typeof FLOATING_CHAT_ALIASES)[number];

export function isFloatingChatAlias(alias: string): alias is FloatingChatAlias {
  return FLOATING_CHAT_ALIASES.includes(alias as FloatingChatAlias);
}

export interface FloatingChatWidgetProps {
  alias: string;
  title?: string;
  /** Mở sẵn cửa sổ chat (vd. khi vào từ lịch sử với openFloating=1) */
  defaultOpen?: boolean;
}

export function FloatingChatWidget({ alias, title = "Trợ lý AI", defaultOpen = false }: FloatingChatWidgetProps) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  const isMain = alias === "main";
  const [selectedAlias, setSelectedAlias] = useState<string>(alias);
  const { assistants } = useResearchAssistants();

  const effectiveAlias = isMain ? selectedAlias : alias;
  const effectiveTitle = useMemo(() => {
    if (!isMain) return title;
    const a = assistants.find((x) => x.alias === selectedAlias);
    return a?.name ?? (selectedAlias === "main" ? "Trợ lý chính" : selectedAlias);
  }, [isMain, selectedAlias, assistants, title]);

  const embedUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin.replace(/\/+$/, "");
    return `${base}/embed/${encodeURIComponent(effectiveAlias)}`;
  }, [effectiveAlias]);

  const assistantOptions = useMemo(() => {
    const list = assistants.filter((a) => a.health === "healthy");
    const mainFirst = [...list].sort((a, b) => {
      if (a.alias === "main") return -1;
      if (b.alias === "main") return 1;
      return (a.name ?? a.alias).localeCompare(b.name ?? b.alias);
    });
    return mainFirst;
  }, [assistants]);

  // Khi là trợ lý main: luôn có ít nhất "Trợ lý chính" để chọn (fallback nếu API chưa trả hoặc không có main)
  const optionsForSelect = useMemo(() => {
    if (assistantOptions.length > 0) return assistantOptions;
    return [{ alias: "main", name: "Trợ lý chính" }];
  }, [assistantOptions]);

  const selectedValid = optionsForSelect.some((a) => a.alias === selectedAlias);
  const valueForSelect = selectedValid ? selectedAlias : "main";

  return (
    <>
      {/* Nút mở chat — góc dưới phải (cao và sang trái một chút) */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="fixed right-6 bottom-12 z-[9998] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        title="Mở chat với Trợ lý chính"
        aria-label="Mở chat"
      >
        <Bot className="h-7 w-7" />
      </button>

      {/* Cửa sổ chat floating */}
      {open && (
        <div
          className="fixed right-6 bottom-28 z-[9999] flex w-[380px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
          style={{ height: "min(600px, calc(100vh - 100px))" }}
        >
          <div className="flex shrink-0 items-center gap-2 bg-primary px-3 py-2 text-primary-foreground">
            {isMain ? (
              <Select
                value={valueForSelect}
                onValueChange={(v) => setSelectedAlias(v)}
              >
                <SelectTrigger
                  className="h-8 flex-1 min-w-0 border-white/30 bg-white/10 text-primary-foreground [&>span]:truncate gap-2"
                  aria-label="Chọn trợ lý"
                >
                  <SelectValue placeholder="Trợ lý chính" />
                </SelectTrigger>
                <SelectContent className="z-[10000]" position="popper">
                  {optionsForSelect.map((a) => {
                    const ItemIcon = "Icon" in a ? (a as ResearchAssistant).Icon : Bot;
                    const itemName = ("name" in a ? a.name : null) ?? (a.alias === "main" ? "Trợ lý chính" : a.alias);
                    const itemBg = "bgColor" in a ? (a as ResearchAssistant).bgColor : "bg-primary/80";
                    const itemIconColor = "iconColor" in a ? (a as ResearchAssistant).iconColor : "text-white";
                    return (
                      <SelectItem key={a.alias} value={a.alias} className="cursor-pointer">
                        <span className="flex items-center gap-2 w-full min-w-0 whitespace-nowrap">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${itemBg}`}>
                            <ItemIcon className={`h-4 w-4 ${itemIconColor}`} />
                          </span>
                          <span className="truncate">{itemName}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <span className="truncate flex-1 font-semibold text-sm">{effectiveTitle}</span>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/20 text-lg leading-none transition hover:bg-white/30"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <iframe
            key={embedUrl}
            src={embedUrl}
            title={`Chat - ${effectiveTitle}`}
            className="min-h-0 flex-1 w-full border-0"
          />
        </div>
      )}
    </>
  );
}
