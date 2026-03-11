import { ErrorPageContent } from "./error-page-content"

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const params = await searchParams
  const reason = params?.reason ?? null
  return <ErrorPageContent reason={reason} />
}
