"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/contexts/language-context"
import { ExternalLink, Info } from "lucide-react"

const AI_PORTAL_URL = "https://ai-portal-nine.vercel.app/"

export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useLanguage()
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME ?? ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          {t("header.about")}
        </DialogTitle>
        <div className="space-y-4 pt-2 text-sm text-muted-foreground">
          <p>
            {t("about.version")}: <strong className="text-foreground">{version}</strong>
          </p>
          {buildTime && (
            <p>
              {t("about.buildTime")}: <strong className="text-foreground">{buildTime}</strong>
            </p>
          )}
          <p className="border-t pt-4">
            {t("about.builtWith")}{" "}
            <a
              href={AI_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              AI Portal
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            — {t("about.builtWithDesc")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
