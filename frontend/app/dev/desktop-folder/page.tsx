import { notFound } from "next/navigation"
import DesktopFolderHarness from "./harness"

/**
 * Trang thử (CHỈ chạy ở môi trường phát triển) để kiểm tra thẻ «Thư mục trên máy» trong ứng dụng desktop
 * mà không cần backend/đăng nhập: hiển thị màn hình dự án với dữ liệu giả.
 * Dùng bởi desktop/test/e2e/folder-card.e2e.test.mjs. Bản production trả về 404.
 */
export default function DesktopFolderDevPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <DesktopFolderHarness />
}
