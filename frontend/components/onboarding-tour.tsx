"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { FolderKanban, LayoutGrid, Bot, History, ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { GUEST_USER_ID } from "@/lib/chat"

const STORAGE_PREFIX = "neu-onboarding-v1:"
const OPEN_EVENT = "open-onboarding"

const STEPS = [
  { key: "project", Icon: FolderKanban },
  { key: "tools", Icon: LayoutGrid },
  { key: "assistants", Icon: Bot },
  { key: "history", Icon: History },
] as const

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1"
  } catch {
    return true
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1")
  } catch {
    /* bỏ qua: trình duyệt chặn lưu trữ */
  }
}

/** Hướng dẫn nhanh 4 bước cho lần đăng nhập đầu tiên; có thể mở lại bằng sự kiện "open-onboarding". */
export function OnboardingTour() {
  const { data: session, status } = useSession()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  const userId = (session?.user as { id?: string } | undefined)?.id
  const loggedIn = status === "authenticated" && !!userId && userId !== GUEST_USER_ID
  const flagKey = `${STORAGE_PREFIX}${userId ?? ""}`

  useEffect(() => {
    if (!loggedIn) return
    if (!readFlag(flagKey)) setOpen(true)
  }, [loggedIn, flagKey])

  useEffect(() => {
    const onOpen = () => {
      setStep(0)
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  const close = () => {
    if (loggedIn) writeFlag(flagKey)
    setOpen(false)
  }

  const current = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <current.Icon className="h-5 w-5 text-primary" />
            {t(`onboarding.${current.key}.title`)}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-1">
            {t(`onboarding.${current.key}.body`)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.key} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
          ))}
        </div>
        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={close}>
            {t("onboarding.skip")}
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("onboarding.back")}
              </Button>
            )}
            {!last ? (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                {t("onboarding.next")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  close()
                  window.dispatchEvent(new CustomEvent("open-add-project"))
                }}
              >
                {t("onboarding.createProject")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
