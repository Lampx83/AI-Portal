"use client"

import Link from "next/link"
import { AlertCircle, Database, RefreshCw, Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { t } from "@/lib/i18n"

export function ErrorPageContent({ reason }: { reason?: string | null }) {
  const locale = "en"
  const isDatabase = reason === "database"

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-xl">
                {isDatabase ? t(locale, "error.databaseTitle") : t(locale, "error.title")}
              </CardTitle>
              <CardDescription>
                {isDatabase ? t(locale, "error.databaseSubtitle") : t(locale, "error.subtitle")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isDatabase ? t(locale, "error.databaseRequired") : t(locale, "error.backendRequired")}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {isDatabase ? (
              <Database className="h-4 w-4 shrink-0" />
            ) : (
              <Server className="h-4 w-4 shrink-0" />
            )}
            <span>
              {isDatabase ? t(locale, "error.databaseHint") : t(locale, "error.backendHint")}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button asChild className="gap-2">
              <Link href="/" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                {t(locale, "error.tryAgain")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault()
                  window.location.reload()
                }}
              >
                {t(locale, "common.refresh")}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
