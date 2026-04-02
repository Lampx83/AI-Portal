"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "next-auth/react";
import { API_CONFIG } from "@/lib/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  Mic,
  MicOff,
  Paperclip,
  X,
  ChevronDown,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

export type UIModel = { model_id: string; name: string };

function fileUploadKey(f: File) {
  return `${f.name}:${f.size}:${f.lastModified}`;
}

type ChatComposerProps = {
  assistantName: string;
  models: UIModel[];
  selectedModel: UIModel | undefined;
  onSelectModel: (m: UIModel) => void;

  // input
  inputValue: string;
  onInputChange: (v: string) => void;
  isLoading: boolean;

  // speech interim
  partialText: string;
  isListening: boolean;
  toggleListening: () => void;

  // files
  attachedFiles: File[];
  setAttachedFiles: (files: File[]) => void;

  // refs
  fileInputRef: React.RefObject<HTMLInputElement>;
  inputRef: React.RefObject<HTMLInputElement>;

  // submit
  onSubmit: (e: React.FormEvent) => void;

  isStreaming: boolean;
  onStop: () => void;

  onFileUploaded?: (file: { name: string; url: string }) => void;

  /** Layout "stacked": model trên hàng trên, input giữa, nút send hàng dưới (dùng cho trợ lý viết) */
  layout?: "default" | "stacked";
  /** Hide model selector UI completely; caller handles model choice. */
  hideModelSelector?: boolean;
  /** Compact mode: merge mic action into submit button. */
  mergeMicIntoSendButton?: boolean;
};

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
  isStreaming,
  onStop,
  onFileUploaded,
  layout = "default",
  hideModelSelector = false,
  mergeMicIntoSendButton = false,
}: ChatComposerProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  /** Trạng thái upload từng file — hiển thị spinner / tích xanh, không dùng toast thành công */
  const [fileUploadStatus, setFileUploadStatus] = React.useState<
    Record<string, "uploading" | "done">
  >({});

  React.useEffect(() => {
    if (attachedFiles.length === 0) setFileUploadStatus({});
  }, [attachedFiles.length]);

  const showInterim = isListening && !!partialText.trim();
  const hasTypedContent = inputValue.trim().length > 0 || attachedFiles.length > 0;
  const canSubmit =
    !isLoading &&
    !isUploading &&
    hasTypedContent;

  const { data: session } = useSession();
  const { toast } = useToast();
  const { t } = useLanguage();

  // --- file upload handling ---
  const handleFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    // Add files to list first + đánh dấu đang upload
    const newFiles = [...attachedFiles, ...files];
    setFileUploadStatus((prev) => {
      const next = { ...prev };
      for (const f of files) {
        next[fileUploadKey(f)] = "uploading";
      }
      return next;
    });
    setAttachedFiles(newFiles);
    setIsUploading(true);

    const uploadedFiles: File[] = [];
    const failedFiles: { file: File; error: string }[] = [];

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("userEmail", session?.user?.email || "anonymous");

        try {
          const uploadUrl = `${API_CONFIG.baseUrl}/api/upload`;
          const res = await fetch(uploadUrl, {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          
          // Handle response cases
          if (res.ok && (res.status === 200 || res.status === 207)) {
            // 200: All success, 207: Partial success (when uploading multiple files)
            if (data.status === "success" || data.status === "partial") {
              if (data.files && data.files.length > 0) {
                // Take first URL (each request uploads one file)
                const fileUrl = data.files[0];
                uploadedFiles.push(file);
                setFileUploadStatus((prev) => ({ ...prev, [fileUploadKey(file)]: "done" }));
                onFileUploaded?.({ name: file.name, url: fileUrl });
              } else {
                failedFiles.push({ 
                  file, 
                  error: "Upload succeeded but no file URL returned" 
                });
              }
            } else {
              failedFiles.push({ 
                file, 
                error: data.error || "Upload failed: Unknown error" 
              });
            }
          } else {
            // Response not OK
            let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
            if (data.error) {
              errorMessage = data.error;
              if (data.details && Array.isArray(data.details)) {
                errorMessage += ` - ${data.details.join(", ")}`;
              } else if (typeof data.details === "string") {
                errorMessage += ` - ${data.details}`;
              }
            }
            failedFiles.push({ file, error: errorMessage });
          }
        } catch (err: any) {
          console.error("Upload failed:", err);
          failedFiles.push({ 
            file, 
            error: err.message || "Network error: Cannot connect to server" 
          });
        }
      }

      // Remove failed uploads from list
      if (failedFiles.length > 0) {
        const remainingFiles = newFiles.filter(
          (f) => !failedFiles.some((ff) => ff.file === f)
        );
        setAttachedFiles(remainingFiles);
        const allowed = new Set(remainingFiles.map(fileUploadKey));
        setFileUploadStatus((prev) => {
          const next: Record<string, "uploading" | "done"> = {};
          for (const [k, v] of Object.entries(prev)) {
            if (allowed.has(k)) next[k] = v;
          }
          return next;
        });

        // Show error message
        const errorMessages = failedFiles.map(
          (ff) => `${ff.file.name}: ${ff.error}`
        ).join("\n");
        
        toast({
          title: "Upload thất bại",
          description: `${failedFiles.length} file không thể upload:\n${errorMessages}`,
          variant: "destructive",
        });
      }

    } catch (err: any) {
      console.error("Unexpected error during upload:", err);
      // Clear all files on unexpected error
      setAttachedFiles(attachedFiles);
      const allowed = new Set(attachedFiles.map(fileUploadKey));
      setFileUploadStatus((prev) => {
        const next: Record<string, "uploading" | "done"> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (allowed.has(k)) next[k] = v;
        }
        return next;
      });
      toast({
        title: "Lỗi upload",
        description: err.message || "Đã xảy ra lỗi không mong đợi khi upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    handleFiles(files);
    e.dataTransfer.clearData();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleFiles(files);
    e.target.value = ""; // reset to allow selecting again
  };

  // --- Model selector: hide when only 1 model (use that model) ---
  const showModelSelector = !hideModelSelector && models.length > 1;
  const ModelSelector = ({
    className = "",
    fullWidth = false,
  }: {
    className?: string;
    fullWidth?: boolean;
  }) => {
    if (models.length === 0) {
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          className={`gap-2 bg-transparent ${
            fullWidth ? "w-full justify-between" : "flex-shrink-0"
          } ${className}`}
        >
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          Không có model
        </Button>
      );
    }
    if (models.length === 1) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`gap-2 bg-transparent ${
              fullWidth ? "w-full justify-between" : "flex-shrink-0"
            } ${className}`}
          >
            <div className="w-2 h-2 rounded-full bg-green-500" />
            {selectedModel?.name || models[0]?.name || "Chọn model"}
            <ChevronDown className="h-4 w-4" />
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
    );
  };

  return (
    <div
      className={`flex-shrink-0 p-4 border-2 border-dashed rounded-lg transition-colors ${
        isDragging
          ? "border-primary bg-primary/10 dark:bg-primary/10"
          : "border-transparent"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Files preview */}
      {attachedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachedFiles.map((file, index) => {
            const uk = fileUploadKey(file);
            const st = fileUploadStatus[uk];
            return (
              <div
                key={uk}
                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm"
              >
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate max-w-32 min-w-0">{file.name}</span>
                {st === "uploading" && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="Đang tải lên" />
                )}
                {st === "done" && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" aria-hidden />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const k = fileUploadKey(file);
                    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
                    setFileUploadStatus((prev) => {
                      const next = { ...prev };
                      delete next[k];
                      return next;
                    });
                  }}
                  className="h-4 w-4 p-0 hover:bg-red-100 dark:hover:bg-red-900 shrink-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Layout: default (horizontal) or stacked */}
      <div className="flex flex-col gap-2">
        {layout === "stacked" ? (
          <>
            {showModelSelector && (
              <div className="w-full">
                <ModelSelector fullWidth />
              </div>
            )}

            {/* Row 2: Input */}
            <form onSubmit={onSubmit} className="flex flex-col gap-2">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder={
                    showInterim
                      ? ""
                      : t("chat.placeholderMessage").replace("{name}", assistantName)
                  }
                  className={`pr-20 text-sm ${
                    showInterim ? "placeholder-transparent" : ""
                  }`}
                  disabled={isLoading}
                />
                {showInterim && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center px-3 pr-20 py-2 text-sm text-gray-400/70 select-none"
                  >
                    <span className="invisible whitespace-pre-wrap">
                      {inputValue ? inputValue + " " : ""}
                    </span>
                    <span className="whitespace-pre-wrap">{partialText}</span>
                  </div>
                )}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 w-8 p-0"
                    aria-label={t("chat.attachFile")}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleListening}
                    className="h-8 w-8 p-0"
                    aria-label={isListening ? t("chat.micOff") : t("chat.micOn")}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Row 3: Send button */}
              <div className="w-full">
                {isStreaming ? (
                  <Button type="button" variant="destructive" onClick={onStop} className="w-full gap-2">
                    ⏹ {t("chat.stop")}
                  </Button>
                ) : (
                  <Button type="submit" disabled={!canSubmit} className="w-full gap-2">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {t("chat.send")}
                  </Button>
                )}
              </div>
            </form>
          </>
        ) : (
          <>
            {showModelSelector && (
              <div className="md:hidden">
                <ModelSelector fullWidth />
              </div>
            )}
            <form onSubmit={onSubmit} className="flex items-center gap-2">
              {showModelSelector && (
                <div className="hidden md:block">
                  <ModelSelector />
                </div>
              )}
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder={
                    showInterim
                      ? ""
                      : t("chat.placeholderMessage").replace("{name}", assistantName)
                  }
                  className={`pr-20 text-sm ${
                    showInterim ? "placeholder-transparent" : ""
                  }`}
                  disabled={isLoading}
                />
                {showInterim && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center px-3 pr-20 py-2 text-sm text-gray-400/70 select-none"
                  >
                    <span className="invisible whitespace-pre-wrap">
                      {inputValue ? inputValue + " " : ""}
                    </span>
                    <span className="whitespace-pre-wrap">{partialText}</span>
                  </div>
                )}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 w-8 p-0"
                    aria-label={t("chat.attachFile")}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  {!mergeMicIntoSendButton && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={toggleListening}
                      className="h-8 w-8 p-0"
                      aria-label={isListening ? t("chat.micOff") : t("chat.micOn")}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>
              {isStreaming ? (
                <Button type="button" variant="destructive" onClick={onStop}>
                  ⏹ {t("chat.stop")}
                </Button>
              ) : mergeMicIntoSendButton && !hasTypedContent ? (
                <Button
                  type="button"
                  onClick={toggleListening}
                  className="h-10 w-10 p-0"
                  aria-label={isListening ? t("chat.micOff") : t("chat.micOn")}
                  title={isListening ? t("chat.micOff") : t("chat.micOn")}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              ) : mergeMicIntoSendButton ? (
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="h-10 w-10 p-0"
                  aria-label={t("chat.send")}
                  title={t("chat.send")}
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              ) : (
                <Button type="submit" disabled={!canSubmit}>
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t("chat.send")}
                </Button>
              )}
            </form>
          </>
        )}

        {/* Warning */}
        <p className="text-center text-xs text-gray-500 mt-2">
          {t("chat.composerDisclaimer")}
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleInputChangeFile}
        className="hidden"
        accept="*/*"
      />
    </div>
  );
}
