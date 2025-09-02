export const metadata = {
  title: 'Research',
  description: 'Hệ thống hỗ trợ nghiên nghiến',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
