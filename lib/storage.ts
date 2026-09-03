import { env } from 'cloudflare:workers';
import { migrationStatements, schemaStatements } from '@/db/schema';
import type { RequestActor } from '@/lib/auth';
import {
  ENGINE_VERSION,
  type EngineResult,
  type RunConfig,
} from '@/lib/evidence-engine';
import { calculateReadiness, type WorkflowReadiness } from '@/lib/workflow';
import type {
  MarketReviewClosure,
  MarketReviewDisposition,
} from '@/lib/market-review';

export type StoredRun = {
  id: string;
  dealId: string;
  dealName: string;
  uploadId: string;
  parentRunId: string | null;
  versionNumber: number;
  engineVersion: string;
  config: RunConfig;
  summary: EngineResult['summary'];
  validation: EngineResult['validation'];
  createdBy: string;
  createdAt: string;
  filename: string;
  inputHash: string;
  rows: EngineResult['rows'];
  reviews: ReviewRecord[];
  requests: EvidenceRequest[];
  audit: AuditEvent[];
  readiness: WorkflowReadiness;
  reviewClosure: MarketReviewClosure | null;
};
export type ReviewRecord = {
  id: string;
  listingId: string;
  decision: 'include' | 'exclude' | 'defer';
  reason: string;
  actor: string;
  createdAt: string;
};
export type EvidenceRequest = {
  id: string;
  title: string;
  // The accountable role (Market analyst, Acquisition lead, …).
  owner: string;
  // The named person the task is handed to. Empty until assigned.
  assignee: string;
  // ISO timestamp the assignee was notified, or null if not yet sent. Reset when
  // the task is reassigned to a different person.
  notifiedAt: string | null;
  status: 'open' | 'blocked' | 'resolved';
  evidenceNote: string;
  updatedAt: string;
  createdAt: string;
};
export type AuditEvent = {
  id: string;
  eventType: string;
  entityId: string | null;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

const bindings = env as unknown as { DB: D1Database; EVIDENCE: R2Bucket };
export const db = () => bindings.DB;
export const evidence = () => bindings.EVIDENCE;
export const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
export const now = () => new Date().toISOString();
let schemaReady: Promise<unknown> | null = null;
export async function ensureSchema() {
  // Create tables/indexes one statement at a time rather than in a single
  // db().batch(). D1's batch is one all-or-nothing transaction, so a single
  // problematic statement (e.g. an index created alongside its table) rolls the
  // whole thing back and leaves the database with NO tables, after which every
  // write silently fails. Every statement here is CREATE ... IF NOT EXISTS, so
  // running them individually is safe, idempotent and self-healing, and partial
  // progress is kept. Only a fully successful pass is cached.
  schemaReady ??= (async () => {
    for (const sql of schemaStatements) {
      await db().prepare(sql).run();
    }
    // Forward migrations: ADD COLUMN has no IF NOT EXISTS, so tolerate the
    // "duplicate column name" case (column already present) and rethrow anything
    // else. Idempotent and self-healing like the CREATE statements above.
    for (const sql of migrationStatements) {
      try {
        await db().prepare(sql).run();
      } catch (error) {
        if (!/duplicate column name/i.test(String(error))) throw error;
      }
    }
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  await schemaReady;
}
const parsed = <T>(value: unknown) => JSON.parse(String(value)) as T;

export async function getRun(runId: string): Promise<StoredRun | null> {
  await ensureSchema();
  const run = await db()
    .prepare(
      `SELECT r.*, d.name deal_name, u.filename, u.sha256 input_hash FROM runs r JOIN deals d ON d.id=r.deal_id JOIN uploads u ON u.id=r.upload_id WHERE r.id=?`,
    )
    .bind(runId)
    .first<Record<string, unknown>>();
  if (!run) return null;
  const [rowResult, reviewResult, requestResult, auditResult, closureResult] =
    await Promise.all([
      db()
        .prepare(
          `SELECT payload_json FROM run_rows WHERE run_id=? ORDER BY listing_id`,
        )
        .bind(runId)
        .all<Record<string, unknown>>(),
      db()
        .prepare(
          `SELECT * FROM review_actions WHERE run_id=? ORDER BY created_at DESC`,
        )
        .bind(runId)
        .all<Record<string, unknown>>(),
      db()
        .prepare(
          `SELECT * FROM evidence_requests WHERE run_id=? ORDER BY created_at`,
        )
        .bind(runId)
        .all<Record<string, unknown>>(),
      db()
        .prepare(
          `SELECT * FROM audit_events WHERE deal_id=? ORDER BY created_at DESC`,
        )
        .bind(run.deal_id)
        .all<Record<string, unknown>>(),
      db()
        .prepare(`SELECT * FROM market_review_closures WHERE deal_id=?`)
        .bind(run.deal_id)
        .first<Record<string, unknown>>(),
    ]);
  const latest = new Map<string, ReviewRecord>();
  for (const item of reviewResult.results)
    if (!latest.has(String(item.listing_id)))
      latest.set(String(item.listing_id), {
        id: String(item.id),
        listingId: String(item.listing_id),
        decision: item.decision as ReviewRecord['decision'],
        reason: String(item.reason),
        actor: String(item.actor),
        createdAt: String(item.created_at),
      });
  const rows = rowResult.results.map((item) =>
    parsed<EngineResult['rows'][number]>(item.payload_json),
  );
  const reviews = [...latest.values()];
  const requests = requestResult.results.map((item) => ({
    id: String(item.id),
    title: String(item.title),
    owner: String(item.owner),
    assignee: (item.assignee as string | null) ?? '',
    notifiedAt: (item.notified_at as string | null) ?? null,
    status: item.status as EvidenceRequest['status'],
    evidenceNote: String(item.evidence_note),
    updatedAt: String(item.updated_at),
    createdAt: String(item.created_at),
  }));
  return {
    id: String(run.id),
    dealId: String(run.deal_id),
    dealName: String(run.deal_name),
    uploadId: String(run.upload_id),
    parentRunId:
      typeof run.parent_run_id === 'string' ? run.parent_run_id : null,
    versionNumber: Number(run.version_number),
    engineVersion: String(run.engine_version),
    config: parsed(run.config_json),
    summary: parsed(run.summary_json),
    validation: parsed(run.validation_json),
    createdBy: String(run.created_by),
    createdAt: String(run.created_at),
    filename: String(run.filename),
    inputHash: String(run.input_hash),
    rows,
    reviews,
    requests,
    audit: auditResult.results.map((item) => ({
      id: String(item.id),
      eventType: String(item.event_type),
      entityId: typeof item.entity_id === 'string' ? item.entity_id : null,
      actor: String(item.actor),
      payload: parsed(item.payload_json),
      createdAt: String(item.created_at),
    })),
    readiness: calculateReadiness(rows, reviews, requests),
    reviewClosure: closureResult
      ? {
          id: String(closureResult.id),
          runId: String(closureResult.run_id),
          disposition: closureResult.disposition as MarketReviewDisposition,
          rationale: String(closureResult.rationale),
          actor: String(closureResult.actor),
          createdAt: String(closureResult.created_at),
        }
      : null,
  };
}

export async function completeMarketReview(input: {
  run: StoredRun;
  disposition: MarketReviewDisposition;
  rationale: string;
  actor: RequestActor;
}) {
  await ensureSchema();
  const timestamp = now();
  const closureId = id('mrc');
  await db().batch([
    db()
      .prepare(
        `INSERT INTO market_review_closures(id,deal_id,run_id,disposition,rationale,actor,created_at) VALUES(?,?,?,?,?,?,?)`,
      )
      .bind(
        closureId,
        input.run.dealId,
        input.run.id,
        input.disposition,
        input.rationale,
        input.actor.label,
        timestamp,
      ),
    db()
      .prepare(
        `INSERT INTO audit_events(id,deal_id,run_id,event_type,entity_id,actor,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id('evt'),
        input.run.dealId,
        input.run.id,
        'market_review_completed',
        closureId,
        input.actor.label,
        JSON.stringify({
          actorId: input.actor.id,
          disposition: input.disposition,
          rationale: input.rationale,
          runVersion: input.run.versionNumber,
          inputHash: input.run.inputHash,
        }),
        timestamp,
      ),
  ]);
}

export async function listRuns() {
  await ensureSchema();
  const result = await db()
    .prepare(
      `SELECT r.id, r.deal_id, d.name deal_name, r.version_number, r.created_at, r.engine_version, u.filename,
              c.id closure_id
       FROM runs r
       JOIN deals d ON d.id=r.deal_id
       JOIN uploads u ON u.id=r.upload_id
       LEFT JOIN market_review_closures c ON c.run_id=r.id
       ORDER BY r.created_at DESC LIMIT 30`,
    )
    .all<Record<string, unknown>>();
  return result.results.map((run) => ({
    id: String(run.id),
    dealId: String(run.deal_id),
    dealName: String(run.deal_name),
    versionNumber: Number(run.version_number),
    createdAt: String(run.created_at),
    engineVersion: String(run.engine_version),
    filename: typeof run.filename === 'string' ? run.filename : '',
    status: run.closure_id ? ('complete' as const) : ('in_progress' as const),
  }));
}

export async function persistRun(input: {
  dealId: string;
  dealName: string;
  uploadId: string;
  parentRunId?: string | null;
  versionNumber: number;
  actor: RequestActor;
  filename: string;
  csv: string;
  inputHash: string;
  config: RunConfig;
  result: EngineResult;
  createUpload: boolean;
  operationKey?: string;
  requests?: EvidenceRequest[];
}) {
  await ensureSchema();
  const createdAt = now();
  const runId = id('run');
  const objectKey = `uploads/${input.dealId}/${input.uploadId}.csv`;
  const statements: D1PreparedStatement[] = [];
  let rawObjectWritten = false;
  if (input.createUpload) {
    await evidence().put(objectKey, input.csv, {
      httpMetadata: { contentType: 'text/csv; charset=utf-8' },
      customMetadata: { sha256: input.inputHash, filename: input.filename },
    });
    rawObjectWritten = true;
    statements.push(
      db()
        .prepare(`INSERT INTO deals(id,name,created_at) VALUES(?,?,?)`)
        .bind(input.dealId, input.dealName, createdAt),
    );
    statements.push(
      db()
        .prepare(
          `INSERT INTO uploads(id,deal_id,filename,object_key,sha256,byte_size,row_count,validation_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          input.uploadId,
          input.dealId,
          input.filename,
          objectKey,
          input.inputHash,
          new TextEncoder().encode(input.csv).byteLength,
          input.result.validation.rawRows,
          JSON.stringify(input.result.validation),
          createdAt,
        ),
    );
  }
  statements.push(
    db()
      .prepare(
        `INSERT INTO runs(id,deal_id,upload_id,parent_run_id,version_number,engine_version,config_json,summary_json,validation_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        runId,
        input.dealId,
        input.uploadId,
        input.parentRunId ?? null,
        input.versionNumber,
        `engine-${ENGINE_VERSION}`,
        JSON.stringify(input.config),
        JSON.stringify(input.result.summary),
        JSON.stringify(input.result.validation),
        input.actor.label,
        createdAt,
      ),
  );
  for (const row of input.result.rows)
    statements.push(
      db()
        .prepare(
          `INSERT INTO run_rows(id,run_id,listing_id,payload_json,created_at) VALUES(?,?,?,?,?)`,
        )
        .bind(id('row'), runId, row.listingId, JSON.stringify(row), createdAt),
    );
  statements.push(
    db()
      .prepare(
        `INSERT INTO audit_events(id,deal_id,run_id,event_type,entity_id,actor,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id('evt'),
        input.dealId,
        runId,
        input.parentRunId ? 'run_recomputed' : 'run_created',
        runId,
        input.actor.label,
        JSON.stringify({
          actorId: input.actor.id,
          version: input.versionNumber,
          inputHash: input.inputHash,
          acceptedRows: input.result.validation.acceptedRows,
          rejectedRows: input.result.validation.rejectedRows,
        }),
        createdAt,
      ),
  );
  if (input.operationKey)
    statements.push(
      db()
        .prepare(
          `INSERT INTO run_operations(operation_key,deal_id,run_id,created_at) VALUES(?,?,?,?)`,
        )
        .bind(input.operationKey, input.dealId, runId, createdAt),
    );
  if (!input.parentRunId) {
    // Evidence tasks are derived from what THIS run actually found, not a fixed
    // list. Each names a real gap the uploaded listings can't resolve. We do NOT
    // seed an 'achieved-rent' task: achieved rent is a Problem 2 concern, outside
    // the Problem 1 (asking-rent) boundary.
    const derived: string[] = [];
    const rows = input.result.rows ?? [];
    const reasonCount = (code: string) =>
      rows.filter((r) => r.reasons?.includes(code)).length;
    const suspicious =
      reasonCount('suspected_bait_price') +
      reasonCount('suspected_aspirational_ask');
    const confidence = input.result.summary?.askingEvidenceConfidence;
    const trusted = input.result.summary?.baselines?.B2?.count ?? 0;

    if (suspicious > 0)
      derived.push(
        `Verify ${suspicious} suspicious price${suspicious === 1 ? '' : 's'} at source before trusting the rate`,
      );
    if (confidence === 'LOW' || confidence === 'INSUFFICIENT')
      derived.push(
        `Widen the comparable set, only ${trusted} trusted listing${trusted === 1 ? '' : 's'} survived; add sources or fresher listings`,
      );
    // Maintenance basis is genuinely never in a listings pull, so this stays a
    // standing caveat on every run.
    derived.push('Confirm whether maintenance is included in the asking rents');

    for (const title of derived)
      statements.push(
        db()
          .prepare(
            `INSERT INTO evidence_requests(id,run_id,title,owner,status,evidence_note,updated_at,created_at) VALUES(?,?,?,?,?,?,?,?)`,
          )
          .bind(
            id('req'),
            runId,
            title,
            'Unassigned',
            'open',
            '',
            createdAt,
            createdAt,
          ),
      );
  }
  for (const item of input.requests ?? [])
    statements.push(
      db()
        .prepare(
          `INSERT INTO evidence_requests(id,run_id,title,owner,assignee,notified_at,status,evidence_note,updated_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          id('req'),
          runId,
          item.title,
          item.owner,
          item.assignee ?? '',
          item.notifiedAt ?? null,
          item.status,
          item.evidenceNote,
          createdAt,
          createdAt,
        ),
    );
  try {
    await db().batch(statements);
  } catch (error) {
    if (rawObjectWritten)
      await evidence()
        .delete(objectKey)
        .catch(() => undefined);
    throw error;
  }
  return runId;
}

export async function nextVersionForDeal(dealId: string) {
  await ensureSchema();
  const row = await db()
    .prepare(
      `SELECT COALESCE(MAX(version_number), 0) + 1 next_version FROM runs WHERE deal_id=?`,
    )
    .bind(dealId)
    .first<Record<string, unknown>>();
  return Number(row?.next_version ?? 1);
}

export async function runIdForOperation(operationKey: string) {
  await ensureSchema();
  const row = await db()
    .prepare(`SELECT run_id FROM run_operations WHERE operation_key=?`)
    .bind(operationKey)
    .first<Record<string, unknown>>();
  return typeof row?.run_id === 'string' ? row.run_id : null;
}

export async function rawCsvForUpload(uploadId: string) {
  await ensureSchema();
  const upload = await db()
    .prepare(`SELECT object_key FROM uploads WHERE id=?`)
    .bind(uploadId)
    .first<Record<string, unknown>>();
  if (!upload) return null;
  const object = await evidence().get(String(upload.object_key));
  return object ? await object.text() : null;
}
