"use client"

import { useState, useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"

interface TypewriterMarkdownProps {
  content: string
  /** Khoảng thời gian (ms) giữa mỗi lần cập nhật. Mặc định 25ms ≈ 40 cập nhật/giây */
  speed?: number
  /** Số ký tự thêm mỗi lần. Mặc định 2 */
  chunkSize?: number
  /** Có dùng hiệu ứng hay hiển thị luôn full */
  animate?: boolean
  className?: string
  /** Gọi khi nội dung đang gõ thay đổi (để parent scroll xuống) */
  onTypingUpdate?: () => void
}

/**
 * Hiển thị markdown với hiệu ứng gõ chữ (typing effect).
 * Khi animate=true, nội dung sẽ được "gõ" dần từ trái sang phải.
 */
export function TypewriterMarkdown({
  content,
  speed = 25,
  chunkSize: chunkProp = 2,
  animate = true,
  className,
  onTypingUpdate,
}: TypewriterMarkdownProps) {
  const [displayedLength, setDisplayedLength] = useState(0)
  const [hasCompleted, setHasCompleted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fullLength = content?.length ?? 0
  const chunk = Math.max(1, chunkProp)

  useEffect(() => {
    if (!animate || hasCompleted || fullLength === 0) {
      setDisplayedLength(fullLength)
      setHasCompleted(true)
      return
    }

    setDisplayedLength(0)

    intervalRef.current = setInterval(() => {
      setDisplayedLength((prev) => {
        const next = Math.min(prev + chunk, fullLength)
        if (next >= fullLength) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          setHasCompleted(true)
        }
        return next
      })
    }, speed)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [content, animate, hasCompleted, fullLength, speed, chunk])

  // Gọi onTypingUpdate sau khi displayedLength thay đổi (để scroll sau khi DOM cập nhật)
  useEffect(() => {
    if (animate && !hasCompleted && displayedLength > 0) {
      onTypingUpdate?.()
    }
  }, [displayedLength, animate, hasCompleted, onTypingUpdate])

  const displayContent =
    animate && !hasCompleted ? content.slice(0, displayedLength) : content

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {displayContent}
      </ReactMarkdown>
    </div>
  )
}
