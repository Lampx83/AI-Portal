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
import { useAssistants } from "@/hooks/use-assistants";
import type { Assistant } from "@/lib/assistants";

const FLOATING_CHAT_ALIASES = ["data"] as const;
export type FloatingChatAlias = (typeof FLOATING_CHAT_ALIASES)[number];

export function isFloatingChatAlias(alias: string): alias is FloatingChatAlias {
  return FLOATING_CHAT_ALIASES.includes(alias as FloatingChatAlias);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FloatingChatWidgetProps {
  alias: string;
  title?: string;
  /** Mở sẵn cửa sổ chat (vd. khi vào từ lịch sử với openFloating=1) */
  defaultOpen?: boolean;
  /** ID dự án (rid) — truyền vào embed để mỗi phiên chat gắn với dự án, hỗ trợ nhiều phiên phân tích/dự án */
  projectId?: string;
  /** ID phiên chat — khi có: embed mở đúng phiên đó (vd. chọn phân tích cũ); khi không có: phiên mới */
  sessionId?: string | null;
}

export function FloatingChatWidget({ alias, title = "Trợ lý AI", defaultOpen = false, projectId, sessionId }: FloatingChatWidgetProps) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  const isCentral = alias === "central";
  const [selectedAlias, setSelectedAlias] = useState<string>(alias);
  const { assistants } = useAssistants();

  const effectiveAlias = isCentral ? selectedAlias : alias;
  const effectiveTitle = useMemo(() => {
    if (!isCentral) return title;
    const a = assistants.find((x) => x.alias === selectedAlias);
    return a?.name ?? (selectedAlias === "central" ? "Trợ lý chính" : selectedAlias);
  }, [isCentral, selectedAlias, assistants, title]);

  const embedUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin.replace(/\/+$/, "");
    const params = new URLSearchParams();
    if (projectId && UUID_RE.test(projectId)) params.set("rid", projectId);
    if (sessionId && UUID_RE.test(sessionId)) params.set("sid", sessionId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return `${base}/embed/${encodeURIComponent(effectiveAlias)}${qs}`;
  }, [effectiveAlias, projectId, sessionId]);

  // Danh sách trợ lý trong dropdown (không gồm Trợ lý chính — mặc định khi không chọn ai)
  const optionsForSelect = useMemo(() => {
    return assistants
      .filter((a) => a.health === "healthy" && !["central", "main", "write", "data"].includes(a.alias))
      .sort((a, b) => (a.name ?? a.alias).localeCompare(b.name ?? b.alias));
  }, [assistants]);

  const selectedValid = optionsForSelect.some((a) => a.alias === selectedAlias);
  const valueForSelect = selectedValid ? selectedAlias : "";

  return (
    <>
      {/* Nút mở chat — góc dưới phải (cao và sang trái một chút) */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="fixed right-6 bottom-12 z-[9998] flex h-14 w-14 items-center justify-center rounded-full bg-neu-blue text-white shadow-lg transition hover:scale-105 hover:shadow-xl hover:bg-neu-blue/90 focus:outline-none focus:ring-2 focus:ring-neu-blue focus:ring-offset-2"
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
          <div className="flex shrink-0 items-center gap-2 bg-neu-blue px-3 py-2 text-white">
            {isCentral ? (
              optionsForSelect.length > 0 ? (
                <Select
                  value={valueForSelect}
                  onValueChange={(v) => setSelectedAlias(v || "central")}
                >
                  <SelectTrigger
                    className="h-8 flex-1 min-w-0 border-white/30 bg-white/10 text-white [&>span]:truncate gap-2"
                    aria-label="Chọn trợ lý"
                  >
                    <SelectValue placeholder="Trợ lý chính" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]" position="popper">
                    {optionsForSelect.map((a) => {
                      const ItemIcon = "Icon" in a ? (a as Assistant).Icon : Bot;
                      const itemName = ("name" in a ? a.name : null) ?? a.alias;
                      return (
                        <SelectItem key={a.alias} value={a.alias} className="cursor-pointer">
                          <span className="flex items-center gap-2 w-full min-w-0 whitespace-nowrap">
                            <ItemIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{itemName}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <span className="truncate flex-1 font-semibold text-sm">{effectiveTitle}</span>
              )
            ) : (
              <span className="truncate flex-1 font-semibold text-sm">{effectiveTitle}</span>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/20 text-white text-lg leading-none transition hover:bg-white/30"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative flex-1 min-h-0 min-h-[320px] overflow-hidden flex flex-col">
            <iframe
              key={embedUrl}
              src={embedUrl}
              title={`Chat - ${effectiveTitle}`}
              className="absolute inset-0 w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </>
  );
}
