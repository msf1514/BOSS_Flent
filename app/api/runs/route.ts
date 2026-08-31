import { ENGINE_VERSION, runEvidenceEngine, sha256, type RunConfig } from '@/lib/evidence-engine';
import { getRun, id, listRuns, persistRun } from '@/lib/storage';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  try {
    const runId = new URL(request.url).searchParams.get('id');
    if (!runId) return json({ runs: await listRuns(), engineVersion: ENGINE_VERSION });
    const run = await getRun(runId);
    return run ? json({ run }) : json({ error: 'Run not found.' }, 404);
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Storage unavailable.' }, 500); }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'A CSV file is required.' }, 400);
    if (!file.name.toLowerCase().endsWith('.csv')) return json({ error: 'Only .csv files are accepted.' }, 415);
    if (file.size > 2_000_000) return json({ error: 'CSV must be 2 MB or smaller.' }, 413);
    const configValue = form.get('config');
    const actorValue = form.get('actor');
    const config = JSON.parse(typeof configValue === 'string' ? configValue : '{}') as RunConfig;
    const actor = (typeof actorValue === 'string' ? actorValue : 'Pilot reviewer').slice(0, 80);
    const csv = await file.text();
    const result = await runEvidenceEngine(csv, config);
    if (!result.rows.length && result.validation.errorCount) return json({ error: 'The file cannot be analysed until blocking validation errors are fixed.', validation: result.validation }, 422);
    const dealId = id('deal'); const uploadId = id('upload'); const inputHash = await sha256(csv);
    const runId = await persistRun({ dealId, dealName: config.dealName || 'Untitled deal', uploadId, versionNumber: 1, actor, filename: file.name, csv, inputHash, config, result, createUpload: true });
    return json({ run: await getRun(runId) }, 201);
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'The run could not be created.' }, 500); }
}
