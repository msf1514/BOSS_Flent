import { runEvidenceEngine, type ReviewOverride } from '@/lib/evidence-engine';
import { db, getRun, id, now, persistRun, rawCsvForUpload } from '@/lib/storage';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const value = (key:string, fallback='') => typeof body[key] === 'string' ? body[key] as string : fallback;
    const runId = value('runId'); const actor = value('actor','Pilot reviewer').slice(0,80);
    const run = await getRun(runId);
    if (!run) return json({ error: 'Run not found.' }, 404);
    if (body.action === 'review') {
      const listingId = value('listingId'); const decision = value('decision'); const reason = value('reason').trim();
      if (!run.rows.some((row) => row.listingId === listingId)) return json({ error: 'Listing does not belong to this run.' }, 400);
      if (!['include','exclude','defer'].includes(decision) || reason.length < 4) return json({ error: 'Choose a decision and enter a specific reason.' }, 400);
      const timestamp = now();
      await db().batch([
        db().prepare(`INSERT INTO review_actions(id,run_id,listing_id,decision,reason,actor,created_at) VALUES(?,?,?,?,?,?,?)`).bind(id('rev'),runId,listingId,decision,reason,actor,timestamp),
        db().prepare(`INSERT INTO audit_events(id,deal_id,run_id,event_type,entity_id,actor,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(id('evt'),run.dealId,runId,'review_recorded',listingId,actor,JSON.stringify({decision,reason}),timestamp),
      ]);
      return json({ run: await getRun(runId) });
    }
    if (body.action === 'request') {
      const requestId = value('requestId'); const status = value('status'); const owner = value('owner','Unassigned').slice(0,80); const evidenceNote = value('evidenceNote').slice(0,2000);
      if (!['open','blocked','resolved'].includes(status) || !run.requests.some((item) => item.id === requestId)) return json({ error: 'Invalid evidence request update.' }, 400);
      const timestamp = now();
      await db().batch([
        db().prepare(`UPDATE evidence_requests SET owner=?,status=?,evidence_note=?,updated_at=? WHERE id=? AND run_id=?`).bind(owner,status,evidenceNote,timestamp,requestId,runId),
        db().prepare(`INSERT INTO audit_events(id,deal_id,run_id,event_type,entity_id,actor,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(id('evt'),run.dealId,runId,'evidence_request_updated',requestId,actor,JSON.stringify({status,owner,evidenceNote}),timestamp),
      ]);
      return json({ run: await getRun(runId) });
    }
    if (body.action === 'rerun') {
      const csv = await rawCsvForUpload(run.uploadId);
      if (csv === null) return json({ error: 'The preserved raw source is unavailable.' }, 409);
      const overrides: ReviewOverride[] = run.reviews.map((item) => ({ listingId:item.listingId, decision:item.decision, reason:item.reason }));
      const result = await runEvidenceEngine(csv, run.config, overrides);
      const childId = await persistRun({ dealId:run.dealId, dealName:run.dealName, uploadId:run.uploadId, parentRunId:run.id, versionNumber:run.versionNumber+1, actor, filename:run.filename, csv, inputHash:run.inputHash, config:run.config, result, createUpload:false });
      for (const item of run.requests) await db().prepare(`INSERT INTO evidence_requests(id,run_id,title,owner,status,evidence_note,updated_at,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(id('req'),childId,item.title,item.owner,item.status,item.evidenceNote,now(),now()).run();
      return json({ run: await getRun(childId) }, 201);
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Action failed.' }, 500); }
}
