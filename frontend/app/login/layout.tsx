// Metadata này render phía server, trước khi LanguageProvider (client) mount nên không dùng useLanguage() được.
// Không có cơ chế đọc locale phía server sẵn có trong app này (không có locale cookie) → dùng tiêu đề song ngữ trung lập.
// Không ghi cứng tên «AI Portal»: root layout tự thêm hậu tố tên hệ thống (title template) và mô tả lấy từ branding.
export const metadata = {
  title: 'Đăng nhập / Login',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
