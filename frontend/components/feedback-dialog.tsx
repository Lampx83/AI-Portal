"use client"

import { useMemo, useState } from "react"
import { MessageSquarePlus, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAssistants } from "@/hooks/use-assistants"
import { useTools } from "@/hooks/use-tools"
import { useLanguage } from "@/contexts/language-context"
import { submitFeedback } from "@/lib/api/feedback"

const GENERAL_VALUE = "__general__" // Sentinel for "" because Radix Select does not allow empty value
const ASSISTANT_PREFIX = "assistant:"
const TOOL_PREFIX = "tool:"

interface FeedbackDialogProps {
  /** Alias trợ lý hiện tại (nếu đang ở trang trợ lý) để pre-select */
  currentAssistantAlias?: string | null
}

export function FeedbackDialog({ currentAssistantAlias }: FeedbackDialogProps) {
  const { t } = useLanguage()
  const { assistants } = useAssistants()
  const { tools } = useTools()
  const { toast } = useToast()
  const [content, setContent] = useState("")
  const [targetValue, setTargetValue] = useState<string>(
    currentAssistantAlias ? `${ASSISTANT_PREFIX}${currentAssistantAlias}` : GENERAL_VALUE
  )
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const targetOptions = useMemo(() => {
    const assistantOptions = assistants.map((a) => ({
      value: `${ASSISTANT_PREFIX}${a.alias}`,
      alias: a.alias,
      label: a.name ?? a.alias,
      Icon: a.Icon,
    }))
    const toolOptions = tools.map((tool) => ({
      value: `${TOOL_PREFIX}${tool.alias}`,
      alias: tool.alias,
      label: tool.name ?? tool.alias,
      Icon: tool.Icon,
    }))
    return [...assistantOptions, ...toolOptions]
  }, [assistants, tools])

  const selectedTarget = targetOptions.find((o) => o.value === targetValue) ?? null

  const handleSubmit = async () => {
    const text = content.trim()
    if (!text) {
      toast({ title: t("feedback.contentRequired"), variant: "destructive" })
      return
    }
    if (text.length < 5) {
      toast({ title: t("feedback.minLength"), variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const selectedAlias =
        targetValue === GENERAL_VALUE
          ? null
          : targetValue.startsWith(ASSISTANT_PREFIX)
            ? targetValue.slice(ASSISTANT_PREFIX.length)
            : targetValue.startsWith(TOOL_PREFIX)
              ? targetValue.slice(TOOL_PREFIX.length)
              : null

      await submitFeedback(text, selectedAlias)
      setDone(true)
      setContent("")
      setTargetValue(currentAssistantAlias ? `${ASSISTANT_PREFIX}${currentAssistantAlias}` : GENERAL_VALUE)
      toast({ title: t("feedback.success"), description: t("feedback.thankYou") })
    } catch (e: any) {
      const msg = e?.message
      const desc = typeof msg === "string" && msg.startsWith("feedback.") ? t(msg) : (msg ?? t("feedback.tryAgain"))
      toast({
        title: t("feedback.sendError"),
        description: desc,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4 mb-4">
          <MessageSquarePlus className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <p className="text-muted-foreground mb-2">{t("feedback.thankYouTitle")}</p>
        <Button variant="outline" onClick={() => setDone(false)}>
          {t("feedback.sendAnother")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="feedback-content">{t("feedback.contentLabel")}</Label>
        <Textarea
          id="feedback-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("feedback.placeholder")}
          className="mt-1.5 min-h-[120px] resize-y"
          maxLength={4000}
          disabled={submitting}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {t("feedback.charCount").replace("{current}", String(content.length))}
        </p>
      </div>

      <div>
        <Label>{t("feedback.sendToLabel")}</Label>
        <Select
          value={targetValue}
          onValueChange={setTargetValue}
          disabled={submitting}
        >
          <SelectTrigger className="mt-1.5">
            {selectedTarget ? (
              <span className="flex items-center gap-2 truncate">
                <selectedTarget.Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{selectedTarget.label}</span>
              </span>
            ) : (
              <SelectValue placeholder={t("feedback.generalOption")} />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GENERAL_VALUE}>{t("feedback.generalOption")}</SelectItem>
            {targetOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="flex items-center gap-2">
                  <option.Icon className="h-4 w-4" />
                  {option.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={submitting || content.trim().length < 5}
        >
          {submitting ? (
            t("feedback.submitting")
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {t("feedback.submit")}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
