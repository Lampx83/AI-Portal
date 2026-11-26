import { test } from "node:test"
import assert from "node:assert/strict"
import {
  ACCESS_PREFIX,
  DesktopTokenService,
  isGuestLike,
  MemoryDesktopTokenStore,
  REFRESH_PREFIX,
  sha256,
  type TokenPolicy,
} from "../src/lib/desktop/tokens"
import { GUEST_USER_ID, SYSTEM_USER_ID } from "../src/lib/chat/constants"

const USER = { id: "5b0c7f3e-2f4a-4e6b-9c1d-111111111abc", email: "lam@neu.edu.vn", name: "Lâm" }

function setup(policy: Partial<TokenPolicy> = {}) {
  const store = new MemoryDesktopTokenStore()
  store.users.set(USER.id, USER)
  let now = Date.UTC(2026, 9, 16, 8, 0, 0)
  const pol: TokenPolicy = { accessTtlSec: 3600, refreshTtlSec: 30 * 86400, absoluteTtlSec: 180 * 86400, maxActivePerUser: 3, ...policy }
  const svc = new DesktopTokenService(store, () => pol, () => now)
  return { store, svc, advance: (sec: number) => (now += sec * 1000), nowRef: () => now }
}

test("khách / tài khoản hệ thống / guest-*@local không được cấp token", async () => {
  assert.equal(isGuestLike({ id: GUEST_USER_ID, email: "guest@portal.local" }), true)
  assert.equal(isGuestLike({ id: SYSTEM_USER_ID, email: "system@portal.local" }), true)
  assert.equal(isGuestLike({ id: "a", email: "guest-abc123@local" }), true)
  assert.equal(isGuestLike({ id: "a", email: "guest-bucket@portal.local" }), true)
  assert.equal(isGuestLike({ id: "a", email: "" }), true)
  assert.equal(isGuestLike({ id: "a", email: "lam@neu.edu.vn" }), false)

  const { svc, store } = setup()
  await assert.rejects(() => svc.issue({ id: GUEST_USER_ID, email: "guest@portal.local" }, {}), (e: any) => e.status === 403 && e.code === "guest_not_allowed")
  // Kể cả khi id lạ nhưng email dạng khách lưu trong DB
  store.users.set("6b0c7f3e-2f4a-4e6b-9c1d-111111111abc", { id: "6b0c7f3e-2f4a-4e6b-9c1d-111111111abc", email: "guest-x@local", name: null })
  await assert.rejects(() => svc.issue({ id: "6b0c7f3e-2f4a-4e6b-9c1d-111111111abc", email: "x@neu.edu.vn" }, {}), (e: any) => e.status === 403)
  assert.equal(store.rows.length, 0)
})

test("cấp token: CSDL chỉ lưu băm, access hợp lệ, dữ liệu thiết bị được cắt gọn", async () => {
  const { svc, store } = setup()
  const out = await svc.issue(USER, { device_name: "MacBook\u0000 của Lâm", platform: "darwin", app_version: "0.2.0" })
  assert.ok(out.access_token.startsWith(ACCESS_PREFIX))
  assert.ok(out.refresh_token.startsWith(REFRESH_PREFIX))
  const row = store.rows[0]
  assert.equal(row.access_hash, sha256(out.access_token))
  assert.notEqual(row.access_hash, out.access_token)
  assert.ok(!JSON.stringify(store.rows).includes(out.access_token))
  assert.ok(!JSON.stringify(store.rows).includes(out.refresh_token))
  assert.equal(row.device_name, "MacBook  của Lâm")
  const v = await svc.verifyAccess(out.access_token)
  assert.equal(v.user.id, USER.id)
})

test("access token hết hạn sau TTL; refresh xoay vòng và token cũ mất hiệu lực", async () => {
  const { svc, advance } = setup()
  const a = await svc.issue(USER, {})
  advance(3601)
  await assert.rejects(() => svc.verifyAccess(a.access_token), (e: any) => e.status === 401 && e.code === "expired")
  const b = await svc.refresh(a.refresh_token)
  assert.notEqual(b.access_token, a.access_token)
  await svc.verifyAccess(b.access_token)
  await assert.rejects(() => svc.verifyAccess(a.access_token), (e: any) => e.status === 401)
})

test("dùng lại refresh token cũ (đã xoay) → thu hồi cả phiên thiết bị", async () => {
  const { svc, store } = setup()
  const a = await svc.issue(USER, {})
  const b = await svc.refresh(a.refresh_token)
  await assert.rejects(() => svc.refresh(a.refresh_token), (e: any) => e.code === "refresh_reuse")
  assert.ok(store.rows[0].revoked_at)
  await assert.rejects(() => svc.verifyAccess(b.access_token), (e: any) => e.code === "revoked")
  await assert.rejects(() => svc.refresh(b.refresh_token), (e: any) => e.code === "revoked")
})

test("thu hồi: app tự ngắt kết nối, người dùng thu hồi thiết bị từ web", async () => {
  const { svc } = setup()
  const a = await svc.issue(USER, {})
  assert.equal(await svc.revokeByToken(a.access_token), true)
  await assert.rejects(() => svc.verifyAccess(a.access_token), (e: any) => e.code === "revoked")
  await assert.rejects(() => svc.refresh(a.refresh_token), (e: any) => e.code === "revoked")

  const b = await svc.issue(USER, {})
  const list = await svc.listForUser(USER.id)
  assert.equal(list.length, 1)
  assert.equal(await svc.revokeForUser("7b0c7f3e-2f4a-4e6b-9c1d-111111111abc", b.token_id), false, "không thu hồi được thiết bị của người khác")
  assert.equal(await svc.revokeForUser(USER.id, b.token_id), true)
  await assert.rejects(() => svc.verifyAccess(b.access_token), (e: any) => e.code === "revoked")
})

test("refresh hết hạn và hạn tuyệt đối", async () => {
  const { svc, advance } = setup({ refreshTtlSec: 7200, absoluteTtlSec: 10_000 })
  const a = await svc.issue(USER, {})
  advance(7201)
  await assert.rejects(() => svc.refresh(a.refresh_token), (e: any) => e.code === "expired")
  const b = await svc.issue(USER, {})
  advance(5000)
  const c = await svc.refresh(b.refresh_token)
  // refresh mới không vượt hạn tuyệt đối
  assert.ok(new Date(c.refresh_expires_at).getTime() <= new Date(b.refresh_expires_at).getTime() + 7200_000)
  advance(5100)
  await assert.rejects(() => svc.verifyAccess(c.access_token), (e: any) => e.code === "expired")
})

test("token sai định dạng / không tồn tại bị từ chối; vượt số thiết bị thì thu hồi phiên cũ nhất", async () => {
  const { svc, store } = setup({ maxActivePerUser: 2 })
  await assert.rejects(() => svc.verifyAccess(undefined), (e: any) => e.status === 401 && e.code === "invalid_token")
  await assert.rejects(() => svc.verifyAccess("Bearer abc"), (e: any) => e.status === 401)
  await assert.rejects(() => svc.verifyAccess(ACCESS_PREFIX + "A".repeat(43)), (e: any) => e.code === "invalid_token")
  await assert.rejects(() => svc.verifyAccess(REFRESH_PREFIX + "A".repeat(43)), (e: any) => e.code === "invalid_token", "refresh token không dùng thay access")
  const t1 = await svc.issue(USER, {})
  await new Promise((r) => setTimeout(r, 5))
  await svc.issue(USER, {})
  await new Promise((r) => setTimeout(r, 5))
  await svc.issue(USER, {})
  assert.equal(store.rows.filter((r) => !r.revoked_at).length, 2)
  await assert.rejects(() => svc.verifyAccess(t1.access_token), (e: any) => e.code === "revoked")
})
