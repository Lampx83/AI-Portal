// Metadata này render phía server, trước khi LanguageProvider (client) mount nên không dùng useLanguage() được.
// Không có cơ chế đọc locale phía server sẵn có trong app này (không có locale cookie) → dùng tiêu đề song ngữ trung lập.
export const metadata = {
  title: 'AI Portal - Login / Đăng nhập',
  description: 'AI Portal - Login / Đăng nhập',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
