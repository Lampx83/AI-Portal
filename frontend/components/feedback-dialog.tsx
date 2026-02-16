"use client"

import { useState } from "react"
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
import { useToast } from "@/components/ui/use-toast"
import { useAssistants } from "@/hooks/use-assistants"
import { useLanguage } from "@/contexts/language-context"
import { submitFeedback } from "@/lib/api/feedback"

const GENERAL_VALUE = "__general__" // Sentinel thay cho "" vì Radix Select không cho value rỗng

interface FeedbackDialogProps {
  /** Alias trợ lý hiện tại (nếu đang ở trang trợ lý) để pre-select */
  currentAssistantAlias?: string | null
}

export function FeedbackDialog({ currentAssistantAlias }: FeedbackDialogProps) {
  const { t } = useLanguage()
  const { assistants } = useAssistants()
  const { toast } = useToast()
  const [content, setContent] = useState("")
  const [assistantAlias, setAssistantAlias] = useState<string>(
    currentAssistantAlias ?? GENERAL_VALUE
  )
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

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
      await submitFeedback(text, assistantAlias === GENERAL_VALUE ? null : assistantAlias)
      setDone(true)
      setContent("")
      setAssistantAlias(currentAssistantAlias ?? GENERAL_VALUE)
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
          value={assistantAlias}
          onValueChange={setAssistantAlias}
          disabled={submitting}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder={t("feedback.generalOption")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GENERAL_VALUE}>{t("feedback.generalOption")}</SelectItem>
            {assistants.map((a) => (
              <SelectItem key={a.alias} value={a.alias}>
                <span className="flex items-center gap-2">
                  <a.Icon className="h-4 w-4" />
                  {a.name ?? a.alias}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {t("feedback.generalHint")}
        </p>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting || content.trim().length < 5}
        className="w-full sm:w-auto"
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
  )
}
