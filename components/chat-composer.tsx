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

    return (
        <div className="flex-shrink-0 p-4 border-t dark:border-gray-800">
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

            {/* Form */}
            <form
                onSubmit={onSubmit}
                className="flex flex-col gap-2 md:flex-row md:items-center"
            >
                {/* Row 1 (mobile): Model selector; On desktop it sits inline to the left */}
                <div className="w-full md:w-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2 bg-transparent w-full md:w-auto justify-between md:justify-start"
                            >
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                {selectedModel.name}
                                <ChevronDown className="h-4 w-4 ml-auto md:ml-0" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {models.map((m) => (
                                <DropdownMenuItem
                                    key={m.model_id}
                                    onClick={() => onSelectModel(m)}
                                    className="gap-2"
                                >
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    {m.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Row 2 (mobile): input + send (cùng hàng). On desktop it behaves as the rest of the row */}
                <div className="flex items-center gap-2 md:flex-1">
                    {/* Input + overlay interim + right icons */}
                    <div className="relative flex-1">
                        <Input
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => onInputChange(e.target.value)}
                            placeholder={
                                showInterim
                                    ? ""
                                    : `Nhập tin nhắn cho ${assistantName} (${selectedModel.name})...`
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

                        {/* Right inline actions */}
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

                    {/* Send button (stays on same row with input on mobile; inline on desktop) */}
                    <Button type="submit" disabled={!canSubmit}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </form>

            {/* Hidden file input */}
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
