"use client"

import { forwardRef, useRef, useImperativeHandle, useEffect } from "react"

export const DocEditor = forwardRef<
  HTMLDivElement,
  {
    initialContent: string
    onInput: (html: string) => void
    className?: string
    onKeyDown?: (e: React.KeyboardEvent) => void
  }
>(({ initialContent, onInput, className, onKeyDown }, ref) => {
  const divRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => divRef.current!)
  const mountContent = useRef(initialContent)
  mountContent.current = initialContent
  useEffect(() => {
    const el = divRef.current
    if (el) el.innerHTML = mountContent.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      ref={divRef}
      contentEditable={true}
      suppressContentEditableWarning
      className={className}
      onInput={() => onInput(divRef.current?.innerHTML ?? "")}
      onKeyDown={onKeyDown}
    />
  )
})
DocEditor.displayName = "DocEditor"
