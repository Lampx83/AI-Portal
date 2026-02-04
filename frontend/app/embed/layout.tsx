export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 w-full bg-background flex flex-col min-h-0 overflow-hidden">
      {children}
    </div>
  )
}
