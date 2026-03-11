"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  AGENT_ICON_OPTIONS_POPULAR,
  AGENT_ICON_OPTIONS_MORE,
  getIconComponent,
  type IconName,
} from "@/lib/assistants"

type IconPickerProps = {
  value: IconName | string
  onChange: (icon: IconName) => void
  label?: string
  /** i18n key for "More" / "Thu gọn" */
  moreLabel?: string
  lessLabel?: string
}

export function IconPicker({ value, onChange, label, moreLabel = "Thêm icon", lessLabel = "Thu gọn" }: IconPickerProps) {
  const current = (value || "Bot") as IconName
  const isInPopular = AGENT_ICON_OPTIONS_POPULAR.includes(current)
  const [showMore, setShowMore] = useState(!isInPopular)

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap items-center gap-1">
        {AGENT_ICON_OPTIONS_POPULAR.map((iconName) => {
          const IconComp = getIconComponent(iconName)
          const isSelected = current === iconName
          return (
            <button
              key={iconName}
              type="button"
              onClick={() => onChange(iconName)}
              title={iconName}
              className={`shrink-0 p-1.5 rounded-md border-2 transition-colors ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-input bg-background hover:bg-muted"
              }`}
            >
              <IconComp className="h-4 w-4 text-muted-foreground" />
            </button>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1 h-8 px-2"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              {lessLabel}
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              {moreLabel}
            </>
          )}
        </Button>
      </div>
      {showMore && (
        <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-border mt-2">
          {AGENT_ICON_OPTIONS_MORE.map((iconName) => {
            const IconComp = getIconComponent(iconName)
            const isSelected = current === iconName
            return (
              <button
                key={iconName}
                type="button"
                onClick={() => onChange(iconName)}
                title={iconName}
                className={`shrink-0 p-1.5 rounded-md border-2 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-input bg-background hover:bg-muted"
                }`}
              >
                <IconComp className="h-4 w-4 text-muted-foreground" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
