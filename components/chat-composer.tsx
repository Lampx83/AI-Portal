"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Send, Mic, MicOff, Paperclip, X, ChevronDown } from "lucide-react"

export type UIModel = { model_id: string; name: string }

type ChatComposerProps = {
    assistantName: string
    models: UIModel[]
    selectedModel: UIModel
    onSelectModel: (m: UIModel) => void

    // input
    inputValue: string
    onInputChange: (v: string) => void
    isLoading: boolean

    // speech interim
    partialText: string
    isListening: boolean
    toggleListening: () => void

    // files
    attachedFiles: File[]
    setAttachedFiles: (files: File[]) => void

    // refs
    fileInputRef: React.RefObject<HTMLInputElement>
    inputRef: React.RefObject<HTMLInputElement>

    // submit
    onSubmit: (e: React.FormEvent) => void
}

export default function ChatComposer({
    assistantName,
    models,
    selectedModel,
    onSelectModel,
    inputValue,
    onInputChange,
    isLoading,
    partialText,
    isListening,
    toggleListening,
    attachedFiles,
    setAttachedFiles,
    fileInputRef,
    inputRef,
    onSubmit,
}: ChatComposerProps) {
    const showInterim = isListening && !!partialText.trim()
    const canSubmit = !isLoading && (inputValue.trim().length > 0 || attachedFiles.length > 0)

    // --- Model selector (tái sử dụng cho mobile & desktop) ---
    const ModelSelector = ({ className = "", fullWidth = false }: { className?: string; fullWidth?: boolean }) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`gap-2 bg-transparent ${fullWidth ? "w-full justify-between" : "flex-shrink-0"} ${className}`}
                >
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    {selectedModel.name}
                    <ChevronDown className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {models.map((m) => (
                    <DropdownMenuItem key={m.model_id} onClick={() => onSelectModel(m)} className="gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        {m.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )

    return (
        <div className="flex-shrink-0 p-4">
            {/* Files */}
            {attachedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {attachedFiles.map((file, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm"
                        >
                            <Paperclip className="h-4 w-4" />
                            <span className="truncate max-w-32">{file.name}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setAttachedFiles(attachedFiles.filter((_, i) => i !== index))}
                                className="h-4 w-4 p-0 hover:bg-red-100 dark:hover:bg-red-900"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Layout responsive: mobile (selector trên) / desktop (selector cùng hàng) */}
            <div className="flex flex-col gap-2">
                {/* Mobile-only selector row */}
                <div className="md:hidden">
                    <ModelSelector fullWidth />
                </div>

                {/* Input row (desktop: gồm selector + input + send; mobile: chỉ input + send) */}
                <form onSubmit={onSubmit} className="flex items-center gap-2">
                    {/* Desktop-only selector on the left */}
                    <div className="hidden md:block">
                        <ModelSelector />
                    </div>

                    {/* Input + overlay + icons */}
                    <div className="flex-1 relative">
                        <Input
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => onInputChange(e.target.value)}
                            placeholder={
                                showInterim ? "" : `Nhập tin nhắn cho ${assistantName} (${selectedModel.name})...`
                            }
                            className={`pr-20 text-sm ${showInterim ? "placeholder-transparent" : ""}`}
                            disabled={isLoading}
                        />

                        {/* Interim overlay */}
                        {showInterim && (
                            <div
                                aria-hidden="true"
                                className="
                  pointer-events-none absolute inset-0
                  flex items-center
                  px-3 pr-20 py-2
                  text-sm text-gray-400/70
                  select-none
                "
                            >
                                <span className="invisible whitespace-pre-wrap">
                                    {inputValue ? inputValue + " " : ""}
                                </span>
                                <span className="whitespace-pre-wrap">{partialText}</span>
                            </div>
                        )}

                        {/* File + Mic buttons (inside input container, right side) */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                className="h-8 w-8 p-0"
                                aria-label="Đính kèm tệp"
                            >
                                <Paperclip className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={toggleListening}
                                className="h-8 w-8 p-0"
                                aria-label={isListening ? "Tắt micro" : "Bật micro"}
                            >
                                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    {/* Send */}
                    <Button type="submit" disabled={!canSubmit}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
                {/* Warning note */}
                <p className="text-center text-xs text-gray-500 mt-2">
                    AI có thể mắc lỗi. Hãy kiểm tra các thông tin quan trọng.
                </p>
            </div>

            {/* hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => setAttachedFiles(Array.from(e.target.files || []))}
                className="hidden"
                accept="*/*"
            />
        </div>
    )
}
