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
import { submitFeedback } from "@/lib/api/feedback"

const GENERAL_VALUE = "__general__" // Sentinel thay cho "" vì Radix Select không cho value rỗng

interface FeedbackDialogProps {
  /** Alias trợ lý hiện tại (nếu đang ở trang trợ lý) để pre-select */
  currentAssistantAlias?: string | null
}

export function FeedbackDialog({ currentAssistantAlias }: FeedbackDialogProps) {
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
      toast({ title: "Vui lòng nhập nội dung phản hồi", variant: "destructive" })
      return
    }
    if (text.length < 5) {
      toast({ title: "Nội dung cần ít nhất 5 ký tự", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      await submitFeedback(text, assistantAlias === GENERAL_VALUE ? null : assistantAlias)
      setDone(true)
      setContent("")
      setAssistantAlias(currentAssistantAlias ?? GENERAL_VALUE)
      toast({ title: "Đã gửi phản hồi", description: "Cảm ơn bạn đã góp ý!" })
    } catch (e: any) {
      toast({
        title: "Không gửi được phản hồi",
        description: e?.message ?? "Vui lòng thử lại sau",
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
        <p className="text-muted-foreground mb-2">Cảm ơn bạn đã gửi phản hồi!</p>
        <Button variant="outline" onClick={() => setDone(false)}>
          Gửi phản hồi khác
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="feedback-content">Nội dung phản hồi</Label>
        <Textarea
          id="feedback-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nhập ý kiến, góp ý hoặc báo lỗi của bạn..."
          className="mt-1.5 min-h-[120px] resize-y"
          maxLength={4000}
          disabled={submitting}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {content.length}/4000 ký tự
        </p>
      </div>

      <div>
        <Label>Gửi cho (tùy chọn)</Label>
        <Select
          value={assistantAlias}
          onValueChange={setAssistantAlias}
          disabled={submitting}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Chung / Hệ thống" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GENERAL_VALUE}>Chung / Hệ thống</SelectItem>
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
          Chọn &quot;Chung&quot; để góp ý về toàn hệ thống, hoặc chọn trợ lý cụ thể
        </p>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting || content.trim().length < 5}
        className="w-full sm:w-auto"
      >
        {submitting ? (
          "Đang gửi..."
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Gửi phản hồi
          </>
        )}
      </Button>
    </div>
  )
}
