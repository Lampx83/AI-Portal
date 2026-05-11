"use client"

import { useState } from "react"
import { X, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  submitSurveyResponse,
  logSurveyImpression,
  type ActiveSurvey,
  type SurveyAnswer,
} from "@/lib/api/surveys"
import { markCompleted, markDismissed } from "@/lib/survey-storage"

interface Props {
  survey: ActiveSurvey
  onClose: (reason: "dismissed" | "completed") => void
}

export function SurveyPopup({ survey, onClose }: Props) {
  const { toast } = useToast()
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const setOption = (qid: string, optionId: string) =>
    setAnswers((a) => ({ ...a, [qid]: { option: optionId, text: a[qid]?.text } }))
  const setText = (qid: string, text: string) =>
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], text } }))

  const dc = survey.display_config || {}
  const position = dc.position ?? "center"
  const dismissible = dc.dismissible !== false

  const handleDismiss = () => {
    markDismissed(survey.id)
    logSurveyImpression(survey.id, "dismissed")
    onClose("dismissed")
  }

  const handleSubmit = async () => {
    // validate required
    for (const q of survey.questions) {
      const ans = answers[q.id]
      if (q.type === "text") {
        if (q.is_required && !ans?.text?.trim()) {
          toast({ title: `Vui lòng trả lời: ${q.title}`, variant: "destructive" })
          return
        }
        continue
      }
      if (q.is_required && !ans?.option) {
        toast({ title: `Vui lòng trả lời: ${q.title}`, variant: "destructive" })
        return
      }
      if (ans?.option) {
        const opt = q.options.find((o) => o.id === ans.option)
        if (opt?.allow_text && !ans?.text?.trim() && q.is_required) {
          toast({ title: `Vui lòng nhập nội dung cho "${opt.label}" ở câu: ${q.title}`, variant: "destructive" })
          return
        }
      }
    }
    setSubmitting(true)
    try {
      await submitSurveyResponse(survey.id, answers)
      markCompleted(survey.id)
      setDone(true)
      logSurveyImpression(survey.id, "completed")
      // Tự đóng sau 1.8s
      setTimeout(() => onClose("completed"), 1800)
    } catch (e: any) {
      toast({ title: "Gửi thất bại", description: e?.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const containerClass = (() => {
    switch (position) {
      case "bottom_right":
        return "fixed bottom-4 right-4 z-[100] w-[380px] max-w-[calc(100vw-2rem)] max-h-[80vh] rounded-xl bg-background shadow-2xl border flex flex-col animate-in fade-in slide-in-from-bottom-4"
      case "bottom_bar":
        return "fixed bottom-0 left-0 right-0 z-[100] bg-background shadow-2xl border-t max-h-[60vh] flex flex-col animate-in fade-in slide-in-from-bottom-4"
      case "top_bar":
        return "fixed top-0 left-0 right-0 z-[100] bg-background shadow-2xl border-b max-h-[60vh] flex flex-col animate-in fade-in slide-in-from-top-4"
      case "center":
      default:
        return ""
    }
  })()

  if (done) {
    const message = survey.thank_you_message || "Cảm ơn bạn đã tham gia khảo sát!"
    if (position === "center") {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-background rounded-xl shadow-2xl p-6 max-w-sm text-center">
            <Check className="h-12 w-12 mx-auto text-green-600 mb-2" />
            <p className="text-sm">{message}</p>
          </div>
        </div>
      )
    }
    return (
      <div className={containerClass}>
        <div className="p-4 text-center flex items-center justify-center gap-2">
          <Check className="h-5 w-5 text-green-600" />
          <span className="text-sm">{message}</span>
        </div>
      </div>
    )
  }

  const content = (
    <>
      <div className="flex items-start justify-between p-4 pb-2 border-b">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base truncate">{survey.name}</h3>
          {survey.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{survey.description}</p>
          )}
        </div>
        {dismissible && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 -mr-1 -mt-1 flex-shrink-0"
            onClick={handleDismiss}
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {survey.questions.map((q, qi) => {
          const ans = answers[q.id]
          return (
            <div key={q.id} className="space-y-2">
              <div className="text-base font-semibold text-primary border-l-4 border-primary pl-3 py-1 bg-primary/5 rounded-r">
                {qi + 1}. {q.title}
                {q.is_required && <span className="text-destructive ml-1">*</span>}
              </div>
              {q.description && (
                <div className="text-xs text-muted-foreground">{q.description}</div>
              )}
              {q.type === "text" ? (
                <Textarea
                  value={ans?.text ?? ""}
                  onChange={(e) => setText(q.id, e.target.value)}
                  placeholder="Nhập câu trả lời của bạn…"
                  rows={3}
                />
              ) : (
                <div className="space-y-1.5">
                  {q.options.map((opt) => {
                    const checked = ans?.option === opt.id
                    return (
                      <div key={opt.id}>
                        <label
                          className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                            checked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q_${q.id}`}
                            value={opt.id}
                            checked={checked}
                            onChange={() => setOption(q.id, opt.id)}
                            className="accent-primary"
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                        {checked && opt.allow_text && (
                          <Textarea
                            value={ans?.text ?? ""}
                            onChange={(e) => setText(q.id, e.target.value)}
                            placeholder="Vui lòng ghi rõ…"
                            rows={2}
                            className="mt-1.5 ml-6 w-[calc(100%-1.5rem)]"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="p-4 pt-2 border-t flex justify-end gap-2">
        {dismissible && (
          <Button variant="ghost" size="sm" onClick={handleDismiss} disabled={submitting}>
            Để sau
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={submitting} className="gap-1">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Gửi câu trả lời
        </Button>
      </div>
    </>
  )

  if (position === "center") {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in"
        onClick={(e) => {
          if (dismissible && e.target === e.currentTarget) handleDismiss()
        }}
      >
        <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
          {content}
        </div>
      </div>
    )
  }

  return <div className={containerClass}>{content}</div>
}
