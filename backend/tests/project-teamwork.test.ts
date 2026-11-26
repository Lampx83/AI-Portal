import test from "node:test"
import assert from "node:assert/strict"
import { parseMembersInput, roleOf, cleanFolder, cleanFileName, fixUploadName, canEditContent } from "../src/lib/project-access"
import { parseLifecycleInput, diffLifecycle, normalizeLifecycle, defaultLifecycle } from "../src/lib/project-lifecycle"

const ctx = (actor: string, ...members: string[]) => ({ actorEmail: actor, assignableEmails: new Set([actor, ...members]) })

test("parseMembersInput: chữ thường, bỏ trùng, bỏ chủ, tối đa 30, báo email sai", () => {
  const r = parseMembersInput(
    { members: [{ email: " A@NEU.edu.vn ", role: "viewer" }, { email: "a@neu.edu.vn" }, { email: "owner@neu.edu.vn" }, { email: "xxx" }, "b@neu.edu.vn"] },
    { ownerEmail: "Owner@neu.edu.vn", defaultRole: "editor" }
  )
  assert.deepEqual(r.emails, ["a@neu.edu.vn", "b@neu.edu.vn"])
  assert.equal(r.roles["a@neu.edu.vn"], "viewer")
  assert.equal(r.roles["b@neu.edu.vn"], "editor")
  assert.deepEqual(r.invalid, ["xxx"])
  const many = parseMembersInput({ team_members: Array.from({ length: 40 }, (_, i) => `u${i}@x.vn`) }, { defaultRole: "viewer" })
  assert.equal(many.emails.length, 30)
})

test("parseMembersInput: dạng cũ giữ vai đã có", () => {
  const r = parseMembersInput({ team_members: ["a@x.vn", "n@x.vn"] }, { defaultRole: "viewer", existingRoles: { "a@x.vn": "editor" } })
  assert.equal(r.roles["a@x.vn"], "editor")
  assert.equal(r.roles["n@x.vn"], "viewer")
})

test("roleOf: chủ / biên tập / xem (thiếu vai = xem) / ngoài dự án; email không phân biệt hoa thường", () => {
  const row = { user_id: "U1", team_members: ["e@x.vn", "v@x.vn"], member_roles: { "e@x.vn": "editor" } }
  assert.equal(roleOf(row, "U1", "owner@x.vn"), "owner")
  assert.equal(roleOf(row, "U2", "E@X.vn"), "editor")
  assert.equal(roleOf(row, "U3", "v@x.vn"), "viewer")
  assert.equal(roleOf(row, "U4", "other@x.vn"), null)
  assert.equal(roleOf(row, "U4", null), null)
  assert.equal(canEditContent("viewer"), false)
  assert.equal(canEditContent("editor"), true)
})

test("cleanFolder / cleanFileName / fixUploadName", () => {
  assert.equal(cleanFolder("../a/./b//c/d/e"), "a/b/c")
  assert.equal(cleanFolder(42), "")
  assert.equal(cleanFileName("a/b\\c.docx"), "abc.docx")
  assert.equal(cleanFileName("   ", "x"), "x")
  const mangled = Buffer.from("Đề cương.docx", "utf8").toString("latin1")
  assert.equal(fixUploadName(mangled), "Đề cương.docx")
  assert.equal(fixUploadName("plain.docx"), "plain.docx")
})

function withItems(items: unknown[], prev?: unknown) {
  const lc = defaultLifecycle()
  lc.stages[0].status = "doing"
  ;(lc.stages[0] as any).checklist = items
  return lc
}

test("lifecycle: người phụ trách phải là thành viên; doneBy/doneAt do server ghi, không tin client", () => {
  const raw = withItems([
    { id: "aaaa1111", text: "Việc 1", done: true, assignee: "ngoai@x.vn", doneBy: "gia@x.vn", doneAt: "2020-01-01T00:00:00Z" },
    { id: "bbbb2222", text: "Việc 2", done: false, assignee: "tv@x.vn", due: "2026-12-01" },
  ])
  const out = parseLifecycleInput(raw, undefined, ctx("chu@x.vn", "tv@x.vn"))
  const [a, b] = out.stages[0].checklist
  assert.equal(a.assignee, null)
  assert.equal(a.doneBy, "chu@x.vn")
  assert.notEqual(a.doneAt, "2020-01-01T00:00:00.000Z")
  assert.equal(b.assignee, "tv@x.vn")
  assert.equal(b.due, "2026-12-01")
  assert.equal(b.doneBy, null)
})

test("lifecycle: giữ doneBy cũ khi người khác lưu lại; bỏ tick thì xoá doneBy", () => {
  const first = parseLifecycleInput(withItems([{ id: "aaaa1111", text: "Việc 1", done: true }]), undefined, ctx("tv@x.vn"))
  const again = parseLifecycleInput(withItems([{ id: "aaaa1111", text: "Việc 1", done: true, doneBy: "ke-gian@x.vn" }]), first, ctx("chu@x.vn", "tv@x.vn"))
  assert.equal(again.stages[0].checklist[0].doneBy, "tv@x.vn")
  const undone = parseLifecycleInput(withItems([{ id: "aaaa1111", text: "Việc 1", done: false }]), again, ctx("chu@x.vn"))
  assert.equal(undone.stages[0].checklist[0].doneBy, null)
  assert.equal(undone.stages[0].checklist[0].doneAt, null)
})

test("lifecycle: dữ liệu cũ (không có id) vẫn đọc được và id ổn định giữa các lần đọc", () => {
  const old = { version: 1, stages: [{ id: "explore", status: "doing", checklist: [{ text: "A", done: false }, { text: "A", done: true }] }] }
  const a = normalizeLifecycle(old).stages[0].checklist
  const b = normalizeLifecycle(old).stages[0].checklist
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id))
  assert.notEqual(a[0].id, a[1].id)
})

test("diffLifecycle: nhận ra đổi trạng thái, tick xong, giao việc mới", () => {
  const prev = parseLifecycleInput(withItems([{ id: "aaaa1111", text: "Việc 1", done: false, assignee: "tv@x.vn" }]), undefined, ctx("chu@x.vn", "tv@x.vn"))
  const nextRaw = withItems([
    { id: "aaaa1111", text: "Việc 1", done: true, assignee: "tv@x.vn" },
    { id: "cccc3333", text: "Việc 3", done: false, assignee: "tv@x.vn" },
  ])
  nextRaw.stages[0].status = "done"
  const next = parseLifecycleInput(nextRaw, prev, ctx("chu@x.vn", "tv@x.vn"))
  const kinds = diffLifecycle(prev, next).map((c) => `${c.kind}:${c.text ?? c.status}`)
  assert.ok(kinds.includes("stage_status:done"))
  assert.ok(kinds.includes("item_done:Việc 1"))
  assert.ok(kinds.includes("item_assigned:Việc 3"))
  assert.ok(!kinds.includes("item_assigned:Việc 1"))
})
