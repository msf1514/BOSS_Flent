import { runEvidenceEngine, sha256 } from '@/lib/evidence-engine';
import { demoDeals } from '@/lib/demo-seed';
import { internalError, json } from '@/lib/http';
import {
  completeMarketReview,
  db,
  ensureSchema,
  getRun,
  id,
  now,
  persistRun,
} from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Populate the deals workspace with a realistic demo history the first time it is
// asked for. Every deal is produced by running a noisy listing set through the
// SAME engine an upload uses, so the confidence tier and trusted count are the
// engine's honest output. Idempotent: it seeds once, then does nothing.
const SEED_ACTOR = { id: 'demo-seed', label: 'BOSS demo data' } as const;

export async function POST() {
  try {
    await ensureSchema();
    const existing = await db()
      .prepare(`SELECT 1 FROM runs WHERE created_by=? LIMIT 1`)
      .bind(SEED_ACTOR.label)
      .first();
    if (existing) return json({ seeded: false, reason: 'already-present' });

    let seeded = 0;
    for (const deal of demoDeals()) {
      const inputHash = await sha256(deal.csv);
      const result = await runEvidenceEngine(deal.csv, deal.config, [], {});
      const dealId = id('deal');
      const uploadId = id('upload');
      const runId = await persistRun({
        dealId,
        dealName: deal.dealName,
        uploadId,
        versionNumber: 1,
        actor: SEED_ACTOR,
        filename: deal.filename,
        csv: deal.csv,
        inputHash,
        config: deal.config,
        result,
        createUpload: true,
      });

      if (deal.complete) {
        const run = await getRun(runId);
        if (run) {
          // Resolve the standing evidence tasks so completion is legitimate, then
          // freeze the review. Insufficient-evidence deals are closed honestly as
          // such rather than forced into a usable verdict.
          const timestamp = now();
          for (const req of run.requests) {
            await db()
              .prepare(
                `UPDATE evidence_requests SET status='resolved',owner='Market analyst',assignee='Demo reviewer',evidence_note='Reviewed and cleared for this demo handoff.',updated_at=? WHERE id=? AND run_id=?`,
              )
              .bind(timestamp, req.id, runId)
              .run();
          }
          const fresh = await getRun(runId);
          if (fresh) {
            const disposition =
              fresh.summary.askingEvidenceConfidence === 'INSUFFICIENT'
                ? 'insufficient_evidence'
                : 'usable_with_caveats';
            await completeMarketReview({
              run: fresh,
              disposition,
              rationale:
                disposition === 'insufficient_evidence'
                  ? 'Closed as insufficient market evidence: the surviving comparable set is too thin to support a defensible rate.'
                  : 'Market evidence reviewed and frozen for the wider deal decision, with the recorded caveats.',
              actor: SEED_ACTOR,
            });
          }
        }
      }
      seeded += 1;
    }
    return json({ seeded });
  } catch (error) {
    return internalError(error, 'Could not seed the demo workspace.');
  }
}
