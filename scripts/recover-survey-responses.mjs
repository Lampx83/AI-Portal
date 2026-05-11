#!/usr/bin/env node
/**
 * Recover survey response stats sau khi sửa câu hỏi mất label.
 *
 * Bối cảnh: PUT /api/admin/surveys/:id (bản cũ) DELETE+INSERT lại survey_questions →
 * sinh UUID mới → các response cũ (survey_responses.answers là JSONB chứa question_id/option_id)
 * vẫn còn nhưng chiếu đến UUID đã bị xoá → admin thống kê và CSV không hiển thị nhãn.
 *
 * Script này dùng file CSV xuất ra TRƯỚC khi sửa (label đầy đủ) làm ground truth,
 * dò ngược về current survey_questions (theo title) + current options (theo label),
 * remap lại JSONB answers, rồi UPDATE vào DB.
 *
 * Cách dùng:
 *   # DRY-RUN: in báo cáo, không UPDATE
 *   POSTGRES_HOST=... POSTGRES_USER=... POSTGRES_PASSWORD=... POSTGRES_DB=... \
 *     node scripts/recover-survey-responses.mjs \
 *       --csv /path/to/old.csv \
 *       --slug neu-admissions-2026
 *
 *   # APPLY: thực sự UPDATE
 *   ... node scripts/recover-survey-responses.mjs --csv ... --slug ... --apply
 *
 * Env:
 *   POSTGRES_HOST (default localhost)
 *   POSTGRES_PORT (default 5432)
 *   POSTGRES_USER (default postgres)
 *   POSTGRES_PASSWORD (default postgres)
 *   POSTGRES_DB (REQUIRED — tên database hiện đang dùng, xem data/setup-db.json)
 *   POSTGRES_SSL=true để bật SSL
 *
 * Khuyến nghị: pg_dump backup trước khi --apply.
 */

import fs from "fs"
import path from "path"
import { createRequire } from "module"
import { fileURLToPath } from "url"

// Pg ở backend/node_modules — script đặt ngoài root nên dùng createRequire trỏ vào backend.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRequire = createRequire(path.join(__dirname, "..", "backend", "package.json"))
const pg = backendRequire("pg")
const { Pool } = pg

// ---------- arg parse ----------
const args = process.argv.slice(2)
function arg(name, def = undefined) {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return def
  const v = args[i + 1]
  if (v == null || v.startsWith("--")) return true
  return v
}
const CSV_PATH = arg("csv")
const SLUG = arg("slug")
const APPLY = !!arg("apply", false)
if (!CSV_PATH || !SLUG) {
  console.error("Thiếu --csv <path> hoặc --slug <survey-slug>")
  process.exit(1)
}
if (!fs.existsSync(CSV_PATH)) {
  console.error("Không thấy file CSV:", CSV_PATH)
  process.exit(1)
}

// ---------- CSV parser (RFC4180-ish, đủ cho output của backend) ----------
function parseCsv(text) {
  // Bỏ BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows = []
  let row = []
  let cell = ""
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQ = false
        }
      } else {
        cell += c
      }
    } else {
      if (c === '"') {
        inQ = true
      } else if (c === ",") {
        row.push(cell)
        cell = ""
      } else if (c === "\n") {
        row.push(cell)
        rows.push(row)
        row = []
        cell = ""
      } else if (c === "\r") {
        // skip
      } else {
        cell += c
      }
    }
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

// ---------- main ----------
const POSTGRES_DB = process.env.POSTGRES_DB
if (!POSTGRES_DB) {
  // Thử đọc data/setup-db.json (giống backend) — đặt cạnh scripts/
  const setupFile = path.resolve(process.cwd(), "data", "setup-db.json")
  if (fs.existsSync(setupFile)) {
    try {
      const d = JSON.parse(fs.readFileSync(setupFile, "utf8"))
      if (d?.databaseName) process.env.POSTGRES_DB = d.databaseName
    } catch {}
  }
}

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "postgres",
  database: process.env.POSTGRES_DB || "ai_portal",
  ssl: String(process.env.POSTGRES_SSL).toLowerCase() === "true" ? { rejectUnauthorized: false } : undefined,
})

function norm(s) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ")
}

async function loadSurvey(slug) {
  const s = await pool.query(`SELECT id, slug, name FROM ai_portal.surveys WHERE slug = $1`, [slug])
  if (s.rows.length === 0) throw new Error(`Không thấy survey slug "${slug}"`)
  const surveyId = s.rows[0].id
  const q = await pool.query(
    `SELECT id, order_index, type, title, options
     FROM ai_portal.survey_questions
     WHERE survey_id = $1::uuid
     ORDER BY order_index ASC, id ASC`,
    [surveyId]
  )
  return {
    id: surveyId,
    slug: s.rows[0].slug,
    name: s.rows[0].name,
    questions: q.rows.map((r) => ({
      id: r.id,
      order_index: r.order_index,
      type: r.type,
      title: r.title,
      options: Array.isArray(r.options) ? r.options : [],
    })),
  }
}

function mapHeaderToQuestions(headers, dbQuestions) {
  // headers (đã bỏ 4 cột fixed): mảng title (sau khi cắt "Q: ")
  // Khi có title trùng nhau, gán theo thứ tự xuất hiện ↔ thứ tự câu hỏi DB cùng title.
  const byTitle = new Map() // norm(title) → [dbQuestion,...]
  for (const dq of dbQuestions) {
    const k = norm(dq.title)
    if (!byTitle.has(k)) byTitle.set(k, [])
    byTitle.get(k).push(dq)
  }
  const cursor = new Map()
  const mapping = [] // mỗi phần tử = { columnIndex (0-based trong vùng question), dbQuestion | null, title }
  for (let i = 0; i < headers.length; i++) {
    const raw = headers[i]
    const title = raw.replace(/^Q:\s*/i, "").trim()
    const k = norm(title)
    const candidates = byTitle.get(k) || []
    const cur = cursor.get(k) || 0
    const picked = candidates[cur] || null
    if (picked) cursor.set(k, cur + 1)
    mapping.push({ columnIndex: i, dbQuestion: picked, title })
  }
  return mapping
}

function splitMultiCell(cell, options, allowTextOptionLabels) {
  // multi-choice format: "label1; label2; label3 — freeText"
  // Tách " — " ở cuối nếu phần đuôi không match option label nào.
  const EM = " — " // em-dash khớp với formatAnswerCell ở backend
  let text = ""
  let body = cell
  const lastIdx = cell.lastIndexOf(EM)
  if (lastIdx > -1) {
    const tail = cell.slice(lastIdx + EM.length).trim()
    const head = cell.slice(0, lastIdx)
    // Nếu tail không phải option label nào → đó là freeText
    const tailMatchesOption = options.some((o) => norm(o.label) === norm(tail))
    if (!tailMatchesOption) {
      text = tail
      body = head
    }
  }
  const labels = body.split(";").map((s) => s.trim()).filter(Boolean)
  return { labels, text }
}

function splitSingleCell(cell, options) {
  const EM = " — " // em-dash khớp với formatAnswerCell ở backend
  const idx = cell.indexOf(EM)
  if (idx > -1) {
    const label = cell.slice(0, idx).trim()
    const text = cell.slice(idx + EM.length).trim()
    // Verify label tồn tại; nếu không → toàn bộ cell là label
    const matched = options.some((o) => norm(o.label) === norm(label))
    if (matched) return { label, text }
  }
  return { label: cell.trim(), text: "" }
}

function findOptionId(options, label) {
  const k = norm(label)
  const hit = options.find((o) => norm(o.label) === k)
  return hit ? hit.id : null
}

async function findResponseRow(surveyId, userEmail, guestDeviceId) {
  if (guestDeviceId && guestDeviceId.trim()) {
    const r = await pool.query(
      `SELECT r.id, r.answers FROM ai_portal.survey_responses r
       WHERE r.survey_id = $1::uuid AND r.guest_device_id = $2`,
      [surveyId, guestDeviceId.trim()]
    )
    if (r.rows[0]) return r.rows[0]
  }
  if (userEmail && userEmail.trim()) {
    const r = await pool.query(
      `SELECT r.id, r.answers FROM ai_portal.survey_responses r
       JOIN ai_portal.users u ON u.id = r.user_id
       WHERE r.survey_id = $1::uuid AND lower(u.email) = lower($2)`,
      [surveyId, userEmail.trim()]
    )
    if (r.rows[0]) return r.rows[0]
  }
  return null
}

async function main() {
  console.log(`\n== Recover survey responses ==`)
  console.log(`CSV: ${CSV_PATH}`)
  console.log(`Slug: ${SLUG}`)
  console.log(`Mode: ${APPLY ? "APPLY (sẽ UPDATE DB)" : "DRY-RUN (không UPDATE)"}\n`)

  const text = fs.readFileSync(CSV_PATH, "utf8")
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error("CSV không có dữ liệu")
  const header = rows[0]
  // 4 cột đầu fixed
  const FIXED = ["submitted_at", "user_email", "user_display_name", "guest_device_id"]
  for (let i = 0; i < FIXED.length; i++) {
    if (norm(header[i]) !== FIXED[i]) {
      console.warn(`Cảnh báo: header[${i}] = "${header[i]}", mong đợi "${FIXED[i]}"`)
    }
  }
  const qHeaders = header.slice(FIXED.length)
  console.log(`Số câu hỏi trong CSV: ${qHeaders.length}`)
  console.log(`Số response trong CSV: ${rows.length - 1}\n`)

  const survey = await loadSurvey(SLUG)
  console.log(`Survey DB: id=${survey.id}, ${survey.questions.length} câu hỏi hiện tại`)

  const mapping = mapHeaderToQuestions(qHeaders, survey.questions)
  console.log(`\n--- Mapping CSV column → DB question ---`)
  for (const m of mapping) {
    const dq = m.dbQuestion
    if (!dq) {
      console.log(`  [col ${m.columnIndex + 1}] "${m.title}"  →  ❌ KHÔNG TÌM THẤY trong DB hiện tại`)
    } else {
      console.log(`  [col ${m.columnIndex + 1}] "${m.title}"  →  ${dq.type} (q.id=${dq.id.slice(0, 8)}.., ${dq.options.length} options)`)
    }
  }

  // Process rows
  let matched = 0
  let notMatched = 0
  let willUpdate = 0
  let unchanged = 0
  const unmatchedRows = []
  const unmatchedLabels = new Map() // colIndex → Set<label>
  const updates = [] // { responseId, newAnswers, diff: [...] }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.length === 0 || row.every((c) => !c)) continue
    const userEmail = row[1] || ""
    const guestId = row[3] || ""
    const dbRow = await findResponseRow(survey.id, userEmail, guestId)
    if (!dbRow) {
      notMatched++
      unmatchedRows.push({ row: r, userEmail, guestId })
      continue
    }
    matched++
    const newAnswers = {}
    const diffLines = []

    for (const m of mapping) {
      const cellRaw = row[FIXED.length + m.columnIndex] ?? ""
      const cell = String(cellRaw).trim()
      if (!cell) continue
      if (!m.dbQuestion) continue

      const dq = m.dbQuestion
      if (dq.type === "text") {
        newAnswers[dq.id] = { text: cell.slice(0, 4000) }
        continue
      }
      if (dq.type === "multi_choice") {
        const { labels, text } = splitMultiCell(cell, dq.options)
        const optIds = []
        for (const lab of labels) {
          const oid = findOptionId(dq.options, lab)
          if (oid) optIds.push(oid)
          else {
            if (!unmatchedLabels.has(m.columnIndex)) unmatchedLabels.set(m.columnIndex, new Set())
            unmatchedLabels.get(m.columnIndex).add(lab)
          }
        }
        if (optIds.length > 0) {
          newAnswers[dq.id] = text ? { options: optIds, text: text.slice(0, 4000) } : { options: optIds }
        }
        continue
      }
      // single_choice
      const { label, text } = splitSingleCell(cell, dq.options)
      const oid = findOptionId(dq.options, label)
      if (oid) {
        newAnswers[dq.id] = text ? { option: oid, text: text.slice(0, 4000) } : { option: oid }
      } else {
        if (!unmatchedLabels.has(m.columnIndex)) unmatchedLabels.set(m.columnIndex, new Set())
        unmatchedLabels.get(m.columnIndex).add(label)
      }
    }

    // Compare to current
    const cur = dbRow.answers || {}
    const before = JSON.stringify(cur)
    const after = JSON.stringify(newAnswers)
    if (before === after) {
      unchanged++
    } else {
      willUpdate++
      diffLines.push(`row#${r} (${guestId || userEmail}):`)
      diffLines.push(`  trước: ${before.slice(0, 200)}${before.length > 200 ? "…" : ""}`)
      diffLines.push(`  sau:   ${after.slice(0, 200)}${after.length > 200 ? "…" : ""}`)
      updates.push({ responseId: dbRow.id, newAnswers, diff: diffLines })
    }
  }

  console.log(`\n--- Kết quả ---`)
  console.log(`Match CSV→DB: ${matched}/${rows.length - 1}`)
  console.log(`Không match: ${notMatched}`)
  console.log(`Sẽ UPDATE: ${willUpdate}`)
  console.log(`Không đổi (answers đã đúng): ${unchanged}`)
  if (unmatchedRows.length) {
    console.log(`\nNhững row CSV không tìm thấy trong DB:`)
    for (const u of unmatchedRows) console.log(`  row#${u.row} email="${u.userEmail}" guest="${u.guestId}"`)
  }
  if (unmatchedLabels.size) {
    console.log(`\nLabel không tìm thấy trong options DB hiện tại (sẽ KHÔNG được map):`)
    for (const [colIdx, set] of unmatchedLabels) {
      const m = mapping[colIdx]
      console.log(`  Cột ${colIdx + 1} "${m?.title}":`)
      for (const lab of set) console.log(`    - "${lab}"`)
    }
  }

  // Print sample diffs
  console.log(`\n--- Mẫu diff (tối đa 3 row đầu) ---`)
  for (const u of updates.slice(0, 3)) {
    for (const ln of u.diff) console.log(ln)
  }

  if (!APPLY) {
    console.log(`\nDRY-RUN xong. Nếu OK, chạy lại với --apply để UPDATE thật.`)
    await pool.end()
    return
  }

  console.log(`\n>>> Đang APPLY ${updates.length} UPDATE...`)
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    for (const u of updates) {
      await client.query(
        `UPDATE ai_portal.survey_responses SET answers = $1::jsonb WHERE id = $2::uuid`,
        [JSON.stringify(u.newAnswers), u.responseId]
      )
    }
    await client.query("COMMIT")
    console.log(`Đã UPDATE ${updates.length} row. Xong.`)
  } catch (e) {
    await client.query("ROLLBACK")
    console.error("Lỗi, đã ROLLBACK:", e)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
