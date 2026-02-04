export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen h-full w-full bg-background flex flex-col">
      {children}
    </div>
  )
}
