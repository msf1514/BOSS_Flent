import type { RequestActor } from '@/lib/auth';
import {
  classifyArtifact,
  hashBytes,
  PACKET_MANIFEST,
  type ArtifactKind,
  type Classification,
  type ManifestEntry,
  type Sensitivity,
} from '@/lib/evidence-classification';
import { db, ensureSchema, evidence, id, now } from '@/lib/storage';

// The registry captures every artifact. It never calculates. Routing an
// artifact's *content* into a decision model is a later (P1) concern and is
// deliberately not done here, see docs/CASE_PACKET_COVERAGE_AND_NEXT_WORK.md.
export const REGISTRY_PARSER_VERSION = 'registry-1';

const uniqueConflict = (error: unknown) =>
  error instanceof Error && /unique constraint/i.test(error.message);

export {
  classifyArtifact,
  hashBytes,
  PACKET_MANIFEST,
} from '@/lib/evidence-classification';
export type {
  ArtifactKind,
  Classification,
  Sensitivity,
} from '@/lib/evidence-classification';

export type IngestionStatus =
  | 'received'
  | 'parsed'
  | 'failed'
  | 'superseded'
  | 'deleted';

export type EvidenceArtifact = {
  id: string;
  dealId: string;
  kind: ArtifactKind;
  filename: string;
  objectKey: string;
  contentHash: string;
  mimeType: string;
  byteSize: number;
  sourceSystem: string;
  sourceReference: string;
  capturedBy: string;
  capturedAt: string;
  parserVersion: string;
  ingestionStatus: IngestionStatus;
  sensitivity: Sensitivity;
  retentionPolicy: string;
  note: string;
  supersedesId: string | null;
  createdAt: string;
};

function rowToArtifact(row: Record<string, unknown>): EvidenceArtifact {
  return {
    id: String(row.id),
    dealId: String(row.deal_id),
    kind: row.kind as ArtifactKind,
    filename: String(row.filename),
    objectKey: String(row.object_key),
    contentHash: String(row.content_hash),
    mimeType: String(row.mime_type),
    byteSize: Number(row.byte_size),
    sourceSystem: String(row.source_system),
    sourceReference: String(row.source_reference),
    capturedBy: String(row.captured_by),
    capturedAt: String(row.captured_at),
    parserVersion: String(row.parser_version),
    ingestionStatus: row.ingestion_status as IngestionStatus,
    sensitivity: row.sensitivity as Sensitivity,
    retentionPolicy: String(row.retention_policy),
    note: String(row.note),
    supersedesId:
      typeof row.supersedes_id === 'string' ? row.supersedes_id : null,
    createdAt: String(row.created_at),
  };
}

async function artifactByHash(dealId: string, contentHash: string) {
  const row = await db()
    .prepare(
      `SELECT * FROM evidence_artifacts WHERE deal_id=? AND content_hash=?`,
    )
    .bind(dealId, contentHash)
    .first<Record<string, unknown>>();
  return row ? rowToArtifact(row) : null;
}

export type IngestResult = {
  artifact: EvidenceArtifact;
  duplicate: boolean;
  classification: Classification;
};

// Preserve a raw artifact against a deal. Dedupe is by (deal, content hash):
// identical bytes return the existing artifact instead of a new copy. The R2
// object is written first and rolled back if the DB write fails, mirroring
// persistRun so we never leave an orphaned object.
export async function ingestArtifact(input: {
  dealId: string;
  filename: string;
  mimeType: string;
  bytes: ArrayBuffer;
  actor: RequestActor;
  sourceSystem?: string;
  sourceReference?: string;
  declaredKind?: ArtifactKind;
  sensitivity?: Sensitivity;
  note?: string;
}): Promise<IngestResult> {
  await ensureSchema();

  const classification = classifyArtifact({
    filename: input.filename,
    mimeType: input.mimeType,
    declaredKind: input.declaredKind,
  });

  const contentHash = await hashBytes(input.bytes);
  const existing = await artifactByHash(input.dealId, contentHash);
  if (existing) {
    await recordArtifactAudit({
      dealId: input.dealId,
      artifactId: existing.id,
      eventType: 'artifact_duplicate_ignored',
      actor: input.actor,
      payload: { filename: input.filename, contentHash },
    });
    return { artifact: existing, duplicate: true, classification };
  }

  const artifactId = id('art');
  const objectKey = `artifacts/${input.dealId}/${artifactId}`;
  const createdAt = now();
  const sensitivity = input.sensitivity ?? classification.sensitivity;
  const ingestionStatus: IngestionStatus = classification.supported
    ? 'received'
    : 'failed';

  await evidence().put(objectKey, input.bytes, {
    httpMetadata: { contentType: input.mimeType || 'application/octet-stream' },
    customMetadata: {
      sha256: contentHash,
      filename: input.filename,
      dealId: input.dealId,
      kind: classification.kind,
    },
  });

  try {
    await db().batch([
      db()
        .prepare(
          `INSERT INTO evidence_artifacts(id,deal_id,kind,filename,object_key,content_hash,mime_type,byte_size,source_system,source_reference,captured_by,captured_at,parser_version,ingestion_status,sensitivity,retention_policy,note,supersedes_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          artifactId,
          input.dealId,
          classification.kind,
          input.filename,
          objectKey,
          contentHash,
          input.mimeType || 'application/octet-stream',
          input.bytes.byteLength,
          input.sourceSystem ?? 'manual-upload',
          input.sourceReference ?? '',
          input.actor.label,
          createdAt,
          REGISTRY_PARSER_VERSION,
          ingestionStatus,
          sensitivity,
          'deal-lifetime',
          input.note ?? classification.reason ?? '',
          null,
          createdAt,
        ),
      auditStatement({
        dealId: input.dealId,
        artifactId,
        eventType: classification.supported
          ? 'artifact_ingested'
          : 'artifact_unsupported',
        actor: input.actor,
        payload: {
          filename: input.filename,
          kind: classification.kind,
          contentHash,
          byteSize: input.bytes.byteLength,
          mimeType: input.mimeType,
          sensitivity,
        },
        createdAt,
      }),
    ]);
  } catch (error) {
    // Always drop the just-written object; the row it belonged to never landed.
    await evidence()
      .delete(objectKey)
      .catch(() => undefined);
    // A concurrent identical upload can win the dedupe race between our check
    // and this insert. The unique (deal_id, content_hash) index rejects the
    // loser; treat that as the duplicate it is rather than a 500.
    if (uniqueConflict(error)) {
      const winner = await artifactByHash(input.dealId, contentHash);
      if (winner) return { artifact: winner, duplicate: true, classification };
    }
    throw error;
  }

  const stored = await artifactByHash(input.dealId, contentHash);
  return {
    artifact: stored as EvidenceArtifact,
    duplicate: false,
    classification,
  };
}

export type InventoryEntry = ManifestEntry & {
  received: EvidenceArtifact[];
  status: 'received' | 'missing' | 'partial';
};

export type Inventory = {
  dealId: string;
  entries: InventoryEntry[];
  unsupported: EvidenceArtifact[];
  failed: EvidenceArtifact[];
  summary: {
    receivedKinds: number;
    missingRequired: number;
    unsupportedCount: number;
    failedCount: number;
    totalArtifacts: number;
  };
};

// Deal-scoped read. Tenant isolation is enforced by requiring a dealId and
// never joining across deals, no query in this module returns another deal's
// evidence. (Per-user/team access control is Open Decision #2, not P0.)
export async function listInventory(dealId: string): Promise<Inventory> {
  await ensureSchema();
  const result = await db()
    .prepare(
      `SELECT * FROM evidence_artifacts WHERE deal_id=? AND ingestion_status != 'deleted' ORDER BY created_at DESC`,
    )
    .bind(dealId)
    .all<Record<string, unknown>>();
  const artifacts = result.results.map(rowToArtifact);

  const byKind = new Map<ArtifactKind, EvidenceArtifact[]>();
  for (const artifact of artifacts) {
    const list = byKind.get(artifact.kind) ?? [];
    list.push(artifact);
    byKind.set(artifact.kind, list);
  }

  const entries: InventoryEntry[] = PACKET_MANIFEST.map((entry) => {
    const received = (byKind.get(entry.kind) ?? []).filter(
      (a) =>
        a.ingestionStatus === 'received' || a.ingestionStatus === 'parsed',
    );
    const status: InventoryEntry['status'] =
      received.length === 0
        ? 'missing'
        : entry.multiple
          ? 'partial'
          : 'received';
    return { ...entry, received, status };
  });

  const unsupported = byKind.get('unsupported') ?? [];
  const failed = artifacts.filter((a) => a.ingestionStatus === 'failed');

  return {
    dealId,
    entries,
    unsupported,
    failed,
    summary: {
      receivedKinds: entries.filter((e) => e.status !== 'missing').length,
      missingRequired: entries.filter(
        (e) => e.required && e.status === 'missing',
      ).length,
      unsupportedCount: unsupported.length,
      failedCount: failed.length,
      totalArtifacts: artifacts.length,
    },
  };
}

export async function getArtifactBytes(dealId: string, artifactId: string) {
  await ensureSchema();
  const row = await db()
    .prepare(
      `SELECT object_key, mime_type FROM evidence_artifacts WHERE id=? AND deal_id=?`,
    )
    .bind(artifactId, dealId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  const object = await evidence().get(String(row.object_key));
  if (!object) return null;
  return { body: object.body, mimeType: String(row.mime_type) };
}

async function artifactById(dealId: string, artifactId: string) {
  const row = await db()
    .prepare(`SELECT * FROM evidence_artifacts WHERE id=? AND deal_id=?`)
    .bind(artifactId, dealId)
    .first<Record<string, unknown>>();
  return row ? rowToArtifact(row) : null;
}

export type MutationOutcome =
  | { ok: true; artifact: EvidenceArtifact; changed: boolean }
  | { ok: false; reason: 'not_found' | 'invalid_state' };

// Soft-delete: the row and its R2 object are preserved (audit/retention), only
// the status flips. Idempotent, deleting an already-deleted artifact is a
// no-op success, not an error and not a second audit event.
export async function deleteArtifact(input: {
  dealId: string;
  artifactId: string;
  actor: RequestActor;
  reason?: string;
}): Promise<MutationOutcome> {
  await ensureSchema();
  const current = await artifactById(input.dealId, input.artifactId);
  if (!current) return { ok: false, reason: 'not_found' };
  if (current.ingestionStatus === 'deleted')
    return { ok: true, artifact: current, changed: false };

  const timestamp = now();
  await db().batch([
    db()
      .prepare(
        `UPDATE evidence_artifacts SET ingestion_status='deleted' WHERE id=? AND deal_id=? AND ingestion_status!='deleted'`,
      )
      .bind(input.artifactId, input.dealId),
    auditStatement({
      dealId: input.dealId,
      artifactId: input.artifactId,
      eventType: 'artifact_deleted',
      actor: input.actor,
      payload: {
        previousStatus: current.ingestionStatus,
        reason: input.reason ?? '',
        contentHash: current.contentHash,
      },
      createdAt: timestamp,
    }),
  ]);
  const updated = await artifactById(input.dealId, input.artifactId);
  return { ok: true, artifact: updated as EvidenceArtifact, changed: true };
}

// Supersession: `replacementId` becomes the live version and `supersededId` is
// marked superseded, linked via supersedes_id. Both must belong to the deal and
// share a kind (you don't replace a photo with a CSV). Neither may already be
// deleted. The link is recorded once; re-running with the same pair is a no-op.
export async function supersedeArtifact(input: {
  dealId: string;
  supersededId: string;
  replacementId: string;
  actor: RequestActor;
  note?: string;
}): Promise<MutationOutcome> {
  await ensureSchema();
  if (input.supersededId === input.replacementId)
    return { ok: false, reason: 'invalid_state' };

  const [superseded, replacement] = await Promise.all([
    artifactById(input.dealId, input.supersededId),
    artifactById(input.dealId, input.replacementId),
  ]);
  if (!superseded || !replacement) return { ok: false, reason: 'not_found' };
  if (
    superseded.kind !== replacement.kind ||
    superseded.ingestionStatus === 'deleted' ||
    replacement.ingestionStatus === 'deleted'
  )
    return { ok: false, reason: 'invalid_state' };

  if (
    superseded.ingestionStatus === 'superseded' &&
    replacement.supersedesId === input.supersededId
  )
    return { ok: true, artifact: replacement, changed: false };

  const timestamp = now();
  await db().batch([
    db()
      .prepare(
        `UPDATE evidence_artifacts SET ingestion_status='superseded' WHERE id=? AND deal_id=? AND ingestion_status NOT IN ('deleted','superseded')`,
      )
      .bind(input.supersededId, input.dealId),
    db()
      .prepare(
        `UPDATE evidence_artifacts SET supersedes_id=? WHERE id=? AND deal_id=?`,
      )
      .bind(input.supersededId, input.replacementId, input.dealId),
    auditStatement({
      dealId: input.dealId,
      artifactId: input.replacementId,
      eventType: 'artifact_superseded',
      actor: input.actor,
      payload: {
        supersededId: input.supersededId,
        kind: replacement.kind,
        note: input.note ?? '',
      },
      createdAt: timestamp,
    }),
  ]);
  const updated = await artifactById(input.dealId, input.replacementId);
  return { ok: true, artifact: updated as EvidenceArtifact, changed: true };
}

type AuditInput = {
  dealId: string;
  artifactId: string;
  eventType: string;
  actor: RequestActor;
  payload: Record<string, unknown>;
  createdAt?: string;
};

function auditStatement(input: AuditInput) {
  const createdAt = input.createdAt ?? now();
  return db()
    .prepare(
      `INSERT INTO audit_events(id,deal_id,run_id,event_type,entity_id,actor,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id('evt'),
      input.dealId,
      null,
      input.eventType,
      input.artifactId,
      input.actor.label,
      JSON.stringify({ actorId: input.actor.id, ...input.payload }),
      createdAt,
    );
}

async function recordArtifactAudit(input: AuditInput) {
  await db().batch([auditStatement(input)]);
}
