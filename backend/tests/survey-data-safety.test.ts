import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

/**
 * Chặn mất dữ liệu khảo sát (P0, 24/10/2026): seed chạy lại từng DELETE khảo sát -> CASCADE xoá phản hồi.
 * - Seed thủ công (không có tiền tố số) không được DELETE FROM surveys / survey_responses / survey_questions.
 * - Migration 026 phải đưa FK survey_responses/survey_impressions sang RESTRICT.
 * (Test hành vi trên Postgres thật chạy tay theo hướng dẫn trong commit; ở đây chỉ giữ chốt chặn tĩnh.)
 */
const MIG = path.resolve(__dirname, "../migrations")

test("seed khảo sát thủ công không xoá dữ liệu", () => {
  const seeds = fs.readdirSync(MIG).filter((f) => f.endsWith(".sql") && !/^\d+_/.test(f) && /survey/i.test(f))
  assert.ok(seeds.length > 0)
  for (const f of seeds) {
    const sql = fs.readFileSync(path.join(MIG, f), "utf8").replace(/--.*$/gm, "")
    assert.doesNotMatch(sql, /DELETE\s+FROM\s+ai_portal\.survey/i, `${f} không được DELETE dữ liệu khảo sát`)
    assert.doesNotMatch(sql, /TRUNCATE/i, `${f} không được TRUNCATE`)
  }
})

test("migration 026 đặt FK phản hồi/impression sang RESTRICT", () => {
  const sql = fs.readFileSync(path.join(MIG, "026_survey_data_restrict_fk.sql"), "utf8")
  assert.match(sql, /survey_responses/)
  assert.match(sql, /survey_impressions/)
  assert.match(sql, /ON DELETE RESTRICT/)
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /ON DELETE CASCADE/)
})
