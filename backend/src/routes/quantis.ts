/**
 * Quantis API: datasets và workflows lưu PostgreSQL (schema quantis).
 * Tất cả route (trừ /health) yêu cầu đăng nhập (session).
 */
import { Router, Request, Response } from "express";
import { getToken } from "next-auth/jwt";
import crypto from "crypto";
import { query } from "../lib/db";
import { getSetting } from "../lib/settings";
import { parseCookies } from "../lib/parse-cookies";

const QUANTIS_SCHEMA = "quantis";
const router = Router();

async function getCurrentUserId(req: Request): Promise<string | null> {
  const secret = getSetting("NEXTAUTH_SECRET");
  if (!secret) return null;
  const cookies = parseCookies(req.headers.cookie);
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  });
  return (token as { id?: string })?.id ?? null;
}

function requireAuth(req: Request, res: Response, next: () => void) {
  getCurrentUserId(req).then((userId) => {
    if (!userId) {
      res.status(401).json({ error: "Chưa đăng nhập" });
      return;
    }
    (req as any).quantisUserId = userId;
    next();
  });
}

/** GET /api/quantis/health — không cần auth, để frontend kiểm tra backend. */
router.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "quantis" });
});

router.use(requireAuth);

/** GET /api/quantis/data — trả về toàn bộ datasets + workflows (sync như Annota). */
router.get("/data", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).quantisUserId as string;

    const [dsRes, wfRes] = await Promise.all([
      query<{ id: string; name: string; rows: number; columns: number; column_names: string[]; preview: string[][]; data: string[][] | null; source_format: string; created_at: string; updated_at: string }>(
        `SELECT id, name, rows, columns, column_names, preview, data, source_format, created_at, updated_at FROM ${QUANTIS_SCHEMA}.quantis_datasets WHERE user_id = $1::uuid ORDER BY updated_at DESC`,
        [userId]
      ),
      query<{ id: string; name: string; description: string | null; dataset_id: string | null; steps: any; created_at: string; updated_at: string }>(
        `SELECT id, name, description, dataset_id, steps, created_at, updated_at FROM ${QUANTIS_SCHEMA}.quantis_workflows WHERE user_id = $1::uuid ORDER BY updated_at DESC`,
        [userId]
      ),
    ]);

    const datasets = (dsRes.rows || []).map((r) => ({
      id: r.id,
      name: r.name,
      rows: r.rows,
      columns: r.columns,
      columnNames: r.column_names ?? [],
      preview: (r.preview ?? []) as string[][],
      data: r.data ?? undefined,
      sourceFormat: r.source_format,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    const workflows = (wfRes.rows || []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      datasetId: r.dataset_id,
      steps: (r.steps ?? []) as any[],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({ datasets, workflows });
  } catch (err: any) {
    console.error("Quantis GET data error:", err);
    res.status(500).json({ error: err?.message || "Lỗi tải dữ liệu" });
  }
});

/** POST /api/quantis/data — ghi đè toàn bộ datasets + workflows của user (sync từ client). */
router.post("/data", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).quantisUserId as string;
    const body = req.body || {};
    const datasets = Array.isArray(body.datasets) ? body.datasets : [];
    const workflows = Array.isArray(body.workflows) ? body.workflows : [];

    await query(`DELETE FROM ${QUANTIS_SCHEMA}.quantis_workflows WHERE user_id = $1::uuid`, [userId]);
    await query(`DELETE FROM ${QUANTIS_SCHEMA}.quantis_datasets WHERE user_id = $1::uuid`, [userId]);

    for (const d of datasets) {
      const id = d.id ?? crypto.randomUUID();
      const name = String(d.name ?? "Dataset").trim() || "Dataset";
      const rows = Number(d.rows) || 0;
      const columns = Number(d.columns) || 0;
      const columnNames = Array.isArray(d.columnNames) ? d.columnNames : [];
      const preview = Array.isArray(d.preview) ? d.preview : [];
      const data = Array.isArray(d.data) ? d.data : null;
      const sourceFormat = String(d.sourceFormat ?? "csv").trim() || "csv";
      const createdAt = d.createdAt ?? new Date().toISOString();
      const updatedAt = d.updatedAt ?? new Date().toISOString();
      await query(
        `INSERT INTO ${QUANTIS_SCHEMA}.quantis_datasets (id, user_id, name, rows, columns, column_names, preview, data, source_format, created_at, updated_at) VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10::timestamptz, $11::timestamptz)`,
        [id, userId, name, rows, columns, JSON.stringify(columnNames), JSON.stringify(preview), data ? JSON.stringify(data) : null, sourceFormat, createdAt, updatedAt]
      );
    }

    for (const w of workflows) {
      const id = w.id ?? crypto.randomUUID();
      const name = String(w.name ?? "Workflow").trim() || "Workflow";
      const description = w.description != null ? String(w.description) : null;
      const datasetId = w.datasetId != null ? String(w.datasetId) : null;
      const steps = Array.isArray(w.steps) ? w.steps : [];
      const createdAt = w.createdAt ?? new Date().toISOString();
      const updatedAt = w.updatedAt ?? new Date().toISOString();
      await query(
        `INSERT INTO ${QUANTIS_SCHEMA}.quantis_workflows (id, user_id, name, description, dataset_id, steps, created_at, updated_at) VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, $7::timestamptz, $8::timestamptz)`,
        [id, userId, name, description, datasetId, JSON.stringify(steps), createdAt, updatedAt]
      );
    }

    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("Quantis POST data error:", err);
    res.status(500).json({ error: err?.message || "Lỗi lưu dữ liệu" });
  }
});

/** GET /api/quantis/datasets */
router.get("/datasets", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).quantisUserId as string;
    const result = await query<{
      id: string;
      name: string;
      rows: number;
      columns: number;
      column_names: string[];
      preview: string[][];
      data: string[][] | null;
      source_format: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, rows, columns, column_names, preview, data, source_format, created_at, updated_at
       FROM ${QUANTIS_SCHEMA}.quantis_datasets WHERE user_id = $1::uuid ORDER BY updated_at DESC`,
      [userId]
    );
    const list = result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      rows: r.rows,
      columns: r.columns,
      columnNames: r.column_names ?? [],
      preview: (r.preview ?? []) as string[][],
      data: r.data ?? undefined,
      sourceFormat: r.source_format,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    res.json(list);
  } catch (err: any) {
    console.error("Quantis GET datasets error:", err);
    res.status(500).json({ error: err?.message || "Lỗi tải datasets" });
  }
});

/** POST /api/quantis/datasets */
router.post("/datasets", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).quantisUserId as string;
    const body = req.body || {};
    const id = body.id ?? crypto.randomUUID();
    const name = String(body.name ?? "Dataset").trim() || "Dataset";
    const rows = Number(body.rows) || 0;
    const columns = Number(body.columns) || 0;
    const columnNames = Array.isArray(body.columnNames) ? body.columnNames : [];
    const preview = Array.isArray(body.preview) ? body.preview : [];
    const data = Array.isArray(body.data) ? body.data : null;
    const sourceFormat = String(body.sourceFormat ?? "csv").trim() || "csv";
    const now = new Date().toISOString();

    await query(
      `INSERT INTO ${QUANTIS_SCHEMA}.quantis_datasets
       (id, user_id, name, rows, columns, column_names, preview, data, source_format, created_at, updated_at)
       VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10::timestamptz, $11::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         name = $3, rows = $4, columns = $5, column_names = $6::jsonb, preview = $7::jsonb, data = $8::jsonb,
         source_format = $9, updated_at = $11::timestamptz`,
      [id, userId, name, rows, columns, JSON.stringify(columnNames), JSON.stringify(preview), data ? JSON.stringify(data) : null, sourceFormat, now, now]
    );

    const out = {
      id,
      name,
      rows,
      columns,
      columnNames,
      preview,
      data: data ?? undefined,
      sourceFormat,
      createdAt: now,
      updatedAt: now,
    };
    res.status(201).json(out);
  } catch (err: any) {
    console.error("Quantis POST datasets error:", err);
    res.status(500).json({ error: err?.message || "Lỗi tạo dataset" });
  }
});

/** GET /api/quantis/datasets/:id */
router.get("/datasets/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).quantisUserId as string;
    const id = (req.params as { id?: string }).id;
    if (!id) return res.status(400).json({ error: "Thiếu id" });

    const result = await query<{
      id: string;
      name: string;
      rows: number;
      columns: number;
      column_names: string[];
      preview: string[][];
      data: string[][] | null;
      source_format: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, rows, columns, column_names, preview, data, source_format, created_at, updated_at
       FROM ${QUANTIS_SCHEMA}.quantis_datasets WHERE id = $1 AND user_id = $2::uuid`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy dataset" });

    const r = result.rows[0];
    res.json({
      id: r.id,
      name: r.name,
      rows: r.rows,
      columns: r.columns,
      columnNames: r.column_names ?? [],
      preview: (r.preview ?? []) as string[][],
      data: r.data ?? undefined,
      sourceFormat: r.source_format,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  } catch (err: any) {
    console.error("Quantis GET dataset error:", err);
    res.status(500).json({ error: err?.message || "Lỗi tải dataset" });
  }
});

/** PATCH /api/quantis/datasets/:id */
router.patch("/datasets/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).quantisUserId as string;
    const id = (req.params as { id?: string }).id;
    if (!id) return res.status(400).json({ error: "Thiếu id" });

    const body = req.body || {};
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(String(body.name).trim() || "Dataset");
    }
    if (body.rows !== undefined) {
      updates.push(`rows = $${idx++}`);
      values.push(Number(body.rows) || 0);
    }
    if (body.columns !== undefined) {
      updates.push(`columns = $${idx++}`);
      values.push(Number(body.columns) || 0);
    }
    if (body.columnNames !== undefined) {
      updates.push(`column_names = $${idx++}::jsonb`);
      values.push(JSON.stringify(Array.isArray(body.columnNames) ? body.columnNames : []));
    }
    if (body.preview !== undefined) {
      updates.push(`preview = $${idx++}::jsonb`);
      values.push(JSON.stringify(Array.isArray(body.preview) ? body.preview : []));
    }
    if (body.data !== undefined) {
      updates.push(`data = $${idx++}::jsonb`);
      values.push(Array.isArray(body.data) ? JSON.stringify(body.data) : null);
    }
    if (body.sourceFormat !== undefined) {
      updates.push(`source_format = $${idx++}`);
      values.push(String(body.sourceFormat).trim() || "csv");
    }

    if (updates.length === 0) return res.status(400).json({ error: "Không có trường nào để cập nhật" });

    updates.push(`updated_at = $${idx++}::timestamptz`);
    values.push(new Date().toISOString());
    values.push(id, userId);

    const result = await query(
      `UPDATE ${QUANTIS_SCHEMA}.quantis_datasets SET ${updates.join(", ")} WHERE id = $${idx} AND user_id = $${idx + 1}::uuid RETURNING id`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Không tìm thấy dataset" });
    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("Quantis PATCH dataset error:", err);
    res.status(500).json({ error: err?.message || "Lỗi cập nhật dataset" });
  }
});

/** DELETE /api/quantis/datasets/:id */
router.delete("/datasets/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).quantisUserId as string;
    const id = (req.params as { id?: string }).id;
    if (!id) return res.status(400).json({ error: "Thiếu id" });

    const result = await query(`DELETE FROM ${QUANTIS_SCHEMA}.quantis_datasets WHERE id = $1 AND user_id = $2::uuid RETURNING id`, [id, userId]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Không tìm thấy dataset" });
    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("Quantis DELETE dataset error:", err);
    res.status(500).json({ error: err?.message || "Lỗi xóa dataset" });
  }
});

/** GET /api/quantis/workflows */
router.get("/workflows", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).quantisUserId as string;
    const result = await query<{
      id: string;
      name: string;
      description: string | null;
      dataset_id: string | null;
      steps: any;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, description, dataset_id, steps, created_at, updated_at
       FROM ${QUANTIS_SCHEMA}.quantis_workflows WHERE user_id = $1::uuid ORDER BY updated_at DESC`,
      [userId]
    );
    const list = result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      datasetId: r.dataset_id,
      steps: (r.steps ?? []) as any[],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    res.json(list);
  } catch (err: any) {
    console.error("Quantis GET workflows error:", err);
    res.status(500).json({ error: err?.message || "Lỗi tải workflows" });
  }
});

/** POST /api/quantis/workflows */
router.post("/workflows", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).quantisUserId as string;
    const body = req.body || {};
    const id = body.id ?? crypto.randomUUID();
    const name = String(body.name ?? "Workflow").trim() || "Workflow";
    const description = body.description != null ? String(body.description) : null;
    const datasetId = body.datasetId != null ? String(body.datasetId) : null;
    const steps = Array.isArray(body.steps) ? body.steps : [];
    const now = new Date().toISOString();

    await query(
      `INSERT INTO ${QUANTIS_SCHEMA}.quantis_workflows
       (id, user_id, name, description, dataset_id, steps, created_at, updated_at)
       VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, $7::timestamptz, $8::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         name = $3, description = $4, dataset_id = $5, steps = $6::jsonb, updated_at = $8::timestamptz`,
      [id, userId, name, description, datasetId, JSON.stringify(steps), now, now]
    );

    res.status(201).json({
      id,
      name,
      description: description ?? undefined,
      datasetId,
      steps,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err: any) {
    console.error("Quantis POST workflows error:", err);
    res.status(500).json({ error: err?.message || "Lỗi tạo workflow" });
  }
});

/** GET /api/quantis/workflows/:id */
router.get("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).quantisUserId as string;
    const id = (req.params as { id?: string }).id;
    if (!id) return res.status(400).json({ error: "Thiếu id" });

    const result = await query<{
      id: string;
      name: string;
      description: string | null;
      dataset_id: string | null;
      steps: any;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, description, dataset_id, steps, created_at, updated_at
       FROM ${QUANTIS_SCHEMA}.quantis_workflows WHERE id = $1 AND user_id = $2::uuid`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy workflow" });

    const r = result.rows[0];
    res.json({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      datasetId: r.dataset_id,
      steps: (r.steps ?? []) as any[],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  } catch (err: any) {
    console.error("Quantis GET workflow error:", err);
    res.status(500).json({ error: err?.message || "Lỗi tải workflow" });
  }
});

/** PATCH /api/quantis/workflows/:id */
router.patch("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).quantisUserId as string;
    const id = (req.params as { id?: string }).id;
    if (!id) return res.status(400).json({ error: "Thiếu id" });

    const body = req.body || {};
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(String(body.name).trim() || "Workflow");
    }
    if (body.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(body.description == null ? null : String(body.description));
    }
    if (body.datasetId !== undefined) {
      updates.push(`dataset_id = $${idx++}`);
      values.push(body.datasetId == null ? null : String(body.datasetId));
    }
    if (body.steps !== undefined) {
      updates.push(`steps = $${idx++}::jsonb`);
      values.push(JSON.stringify(Array.isArray(body.steps) ? body.steps : []));
    }

    if (updates.length === 0) return res.status(400).json({ error: "Không có trường nào để cập nhật" });

    updates.push(`updated_at = $${idx++}::timestamptz`);
    values.push(new Date().toISOString());
    values.push(id, userId);

    const result = await query(
      `UPDATE ${QUANTIS_SCHEMA}.quantis_workflows SET ${updates.join(", ")} WHERE id = $${idx} AND user_id = $${idx + 1}::uuid RETURNING id`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Không tìm thấy workflow" });
    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("Quantis PATCH workflow error:", err);
    res.status(500).json({ error: err?.message || "Lỗi cập nhật workflow" });
  }
});

/** DELETE /api/quantis/workflows/:id */
router.delete("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).quantisUserId as string;
    const id = (req.params as { id?: string }).id;
    if (!id) return res.status(400).json({ error: "Thiếu id" });

    const result = await query(`DELETE FROM ${QUANTIS_SCHEMA}.quantis_workflows WHERE id = $1 AND user_id = $2::uuid RETURNING id`, [id, userId]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Không tìm thấy workflow" });
    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("Quantis DELETE workflow error:", err);
    res.status(500).json({ error: err?.message || "Lỗi xóa workflow" });
  }
});

export default router;
