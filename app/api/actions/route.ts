import { actorFromRequest } from '@/lib/auth';
import { runEvidenceEngine, type ReviewOverride } from '@/lib/evidence-engine';
import { internalError, json } from '@/lib/http';
import { sourceAnnotationsForHash } from '@/lib/source-annotations';
import {
  assessMarketReview,
  type MarketReviewDisposition,
} from '@/lib/market-review';
import {
  completeMarketReview,
  db,
  getRun,
  id,
  nextVersionForDeal,
  now,
  persistRun,
  rawCsvForUpload,
  runIdForOperation,
} from '@/lib/storage';

export const dynamic = 'force-dynamic';
const operationKeyPattern = /^[a-zA-Z0-9_-]{16,120}$/;
const uniqueConflict = (error: unknown) =>
  error instanceof Error && /unique constraint/i.test(error.message);

export async function POST(request: Request) {
  try {
    const actor = actorFromRequest(request);
    if (!actor)
      return json(
        { error: 'Sign in is required to change evidence records.' },
        401,
      );
    const body = (await request.json()) as Record<string, unknown>;
    const value = (key: string, fallback = '') =>
      typeof body[key] === 'string' ? (body[key] as string) : fallback;
    const runId = value('runId');
    const run = await getRun(runId);
    if (!run) return json({ error: 'Run not found.' }, 404);
    if (run.reviewClosure && body.action !== 'complete_review')
      return json(
        {
          error:
            'This market review is complete. Its evidence packet is frozen; start a new deal review to analyse new evidence.',
        },
        409,
      );
    if (body.action === 'review') {
      const listingId = value('listingId').slice(0, 200);
      const decision = value('decision');
      const reason = value('reason').trim().slice(0, 2000);
      const row = run.rows.find((item) => item.listingId === listingId);
      if (!row)
        return json({ error: 'Listing does not belong to this run.' }, 400);
      // A reviewer may disagree with ANY engine decision — re-include a row the
      // engine auto-excluded (stale, duplicate, mislabel) or exclude one it kept
      // — provided they give a specific reason. The prior engine state is
      // recorded so every override is a traceable, auditable disagreement rather
      // than a silent edit. (Brief: "inspect listing by listing and disagree".)
      if (
        !['include', 'exclude', 'defer'].includes(decision) ||
        reason.length < 12
      )
        return json(
          { error: 'Choose a decision and enter a specific reason.' },
          400,
        );
      const timestamp = now();
      await db().batch([
        db()
          .prepare(
            `INSERT INTO review_actions(id,run_id,listing_id,decision,reason,actor,created_at) VALUES(?,?,?,?,?,?,?)`,
          )
          .bind(
            id('rev'),
            runId,
            listingId,
            decision,
            reason,
            actor.label,
            timestamp,
          ),
        db()
          .prepare(
            `INSERT INTO audit_events(id,deal_id,run_id,event_type,entity_id,actor,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)`,
          )
          .bind(
            id('evt'),
            run.dealId,
            runId,
            'review_recorded',
            listingId,
            actor.label,
            JSON.stringify({
              actorId: actor.id,
              decision,
              reason,
              priorEngineState: row.b2State,
            }),
            timestamp,
          ),
      ]);
      return json({ run: await getRun(runId) });
    }
    if (body.action === 'request') {
      const requestId = value('requestId').slice(0, 200);
      const status = value('status');
      const owner =
        value('owner', 'Unassigned').trim().slice(0, 80) || 'Unassigned';
      const evidenceNote = value('evidenceNote').trim().slice(0, 2000);
      if (
        !['open', 'blocked', 'resolved'].includes(status) ||
        !run.requests.some((item) => item.id === requestId)
      )
        return json({ error: 'Invalid evidence request update.' }, 400);
      if (status === 'resolved' && evidenceNote.length < 12)
        return json(
          {
            error:
              'Add a specific evidence reference or resolution note before marking this request resolved.',
          },
          400,
        );
      if (status === 'resolved' && owner === 'Unassigned')
        return json(
          {
            error:
              'Assign an accountable role before marking this evidence task resolved.',
          },
          400,
        );
      const timestamp = now();
      await db().batch([
        db()
          .prepare(
            `UPDATE evidence_requests SET owner=?,status=?,evidence_note=?,updated_at=? WHERE id=? AND run_id=?`,
          )
          .bind(owner, status, evidenceNote, timestamp, requestId, runId),
        db()
          .prepare(
            `INSERT INTO audit_events(id,deal_id,run_id,event_type,entity_id,actor,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)`,
          )
          .bind(
            id('evt'),
            run.dealId,
            runId,
            'evidence_request_updated',
            requestId,
            actor.label,
            JSON.stringify({ actorId: actor.id, status, owner, evidenceNote }),
            timestamp,
          ),
      ]);
      return json({ run: await getRun(runId) });
    }
    if (body.action === 'create_request') {
      // Raise a new evidence task — the honest path to resolving distrust that
      // needs evidence we don't yet have (verify a price, confirm a duplicate).
      const title = value('title').trim().slice(0, 200);
      const owner =
        value('owner', 'Unassigned').trim().slice(0, 80) || 'Unassigned';
      const evidenceNote = value('evidenceNote').trim().slice(0, 2000);
      if (title.length < 6)
        return json({ error: 'Give the task a clear, specific title.' }, 400);
      const timestamp = now();
      const requestId = id('req');
      await db().batch([
        db()
          .prepare(
            `INSERT INTO evidence_requests(id,run_id,title,owner,status,evidence_note,updated_at,created_at) VALUES(?,?,?,?,?,?,?,?)`,
          )
          .bind(
            requestId,
            runId,
            title,
            owner,
            'open',
            evidenceNote,
            timestamp,
            timestamp,
          ),
        db()
          .prepare(
            `INSERT INTO audit_events(id,deal_id,run_id,event_type,entity_id,actor,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)`,
          )
          .bind(
            id('evt'),
            run.dealId,
            runId,
            'evidence_request_created',
            requestId,
            actor.label,
            JSON.stringify({ actorId: actor.id, title, owner }),
            timestamp,
          ),
      ]);
      return json({ run: await getRun(runId) });
    }
    if (body.action === 'complete_review') {
      if (run.reviewClosure)
        return json({ run, message: 'Market review is already complete.' });
      const rationale = value('rationale').trim().slice(0, 2000);
      const disposition = value('disposition') as MarketReviewDisposition;
      const assessment = assessMarketReview({
        config: run.config,
        summary: run.summary,
        readiness: run.readiness,
        closure: run.reviewClosure,
        hasUnappliedReviews: run.reviews.length > 0,
      });
      if (!run.readiness.ready)
        return json(
          {
            error:
              'Complete the comparable decisions and evidence tasks before closing this market review.',
          },
          409,
        );
      if (run.reviews.length > 0)
        return json(
          {
            error:
              'Create a new evidence version so recorded comparable decisions are reflected in the frozen estimate before completion.',
          },
          409,
        );
      if (disposition !== assessment.completionDisposition)
        return json(
          {
            error:
              'The completion outcome must match the evidence supported by this run.',
          },
          409,
        );
      if (rationale.length < 20)
        return json(
          {
            error:
              'Record a specific completion rationale (20 characters minimum).',
          },
          400,
        );
      try {
        await completeMarketReview({ run, disposition, rationale, actor });
      } catch (error) {
        if (!uniqueConflict(error)) throw error;
      }
      return json({ run: await getRun(runId) });
    }
    if (body.action === 'rerun') {
      const operationKey = value('operationKey');
      if (!operationKeyPattern.test(operationKey))
        return json({ error: 'A valid rerun operation key is required.' }, 400);
      const existingRunId = await runIdForOperation(operationKey);
      if (existingRunId) return json({ run: await getRun(existingRunId) });
      const csv = await rawCsvForUpload(run.uploadId);
      if (csv === null)
        return json({ error: 'The preserved raw source is unavailable.' }, 409);
      const overrides: ReviewOverride[] = run.reviews.map((item) => ({
        listingId: item.listingId,
        decision: item.decision,
        reason: item.reason,
      }));
      const result = await runEvidenceEngine(
        csv,
        run.config,
        overrides,
        sourceAnnotationsForHash(run.inputHash),
      );
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const versionNumber = await nextVersionForDeal(run.dealId);
          const childId = await persistRun({
            dealId: run.dealId,
            dealName: run.dealName,
            uploadId: run.uploadId,
            parentRunId: run.id,
            versionNumber,
            actor,
            filename: run.filename,
            csv,
            inputHash: run.inputHash,
            config: run.config,
            result,
            createUpload: false,
            operationKey,
            requests: run.requests,
          });
          return json({ run: await getRun(childId) }, 201);
        } catch (error) {
          const committedRunId = await runIdForOperation(operationKey);
          if (committedRunId)
            return json({ run: await getRun(committedRunId) });
          if (!uniqueConflict(error) || attempt === 2) throw error;
        }
      }
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    return internalError(
      error,
      'The action could not be completed. Retry once; duplicate reruns are prevented.',
    );
  }
}
