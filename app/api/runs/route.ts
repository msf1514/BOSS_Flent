import { actorFromRequest } from '@/lib/auth';
import {
  ENGINE_VERSION,
  runEvidenceEngine,
  sha256,
} from '@/lib/evidence-engine';
import { internalError, json } from '@/lib/http';
import { parseRunConfig } from '@/lib/run-config';
import { sourceAnnotationsForHash } from '@/lib/source-annotations';
import { getRun, id, listRuns, persistRun } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const runId = new URL(request.url).searchParams.get('id');
    if (!runId)
      return json({ runs: await listRuns(), engineVersion: ENGINE_VERSION });
    const run = await getRun(runId);
    return run ? json({ run }) : json({ error: 'Run not found.' }, 404);
  } catch (error) {
    return internalError(
      error,
      'The evidence workspace is temporarily unavailable.',
    );
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const actor = actorFromRequest(request);
    if (!actor)
      return json(
        { error: 'Sign in is required to create an evidence run.' },
        401,
      );
    const file = form.get('file');
    if (!(file instanceof File))
      return json({ error: 'A CSV file is required.' }, 400);
    if (!file.name.toLowerCase().endsWith('.csv'))
      return json({ error: 'Only .csv files are accepted.' }, 415);
    if (file.size > 2_000_000)
      return json({ error: 'CSV must be 2 MB or smaller.' }, 413);
    const configValue = form.get('config');
    let rawConfig: unknown;
    try {
      rawConfig = JSON.parse(
        typeof configValue === 'string' ? configValue : '{}',
      );
    } catch {
      return json(
        {
          error: 'Run configuration is not valid JSON.',
          issues: [
            {
              field: 'config',
              message: 'Provide a valid configuration object.',
            },
          ],
        },
        422,
      );
    }
    const parsedConfig = parseRunConfig(rawConfig);
    if (!parsedConfig.ok)
      return json(
        {
          error: 'Correct the run configuration before continuing.',
          issues: parsedConfig.issues,
        },
        422,
      );
    const config = parsedConfig.value;
    const csv = await file.text();
    const inputHash = await sha256(csv);
    const expectedHash = form.get('expectedHash');
    if (typeof expectedHash !== 'string' || expectedHash !== inputHash)
      return json(
        {
          error:
            'The selected file changed after inspection. Inspect the current file again before creating a run.',
        },
        409,
      );
    const result = await runEvidenceEngine(
      csv,
      config,
      [],
      sourceAnnotationsForHash(inputHash),
    );
    if (!result.rows.length && result.validation.errorCount)
      return json(
        {
          error:
            'The file cannot be analysed until blocking validation errors are fixed.',
          validation: result.validation,
        },
        422,
      );
    const dealId = id('deal');
    const uploadId = id('upload');
    const runId = await persistRun({
      dealId,
      dealName: config.dealName || 'Untitled deal',
      uploadId,
      versionNumber: 1,
      actor,
      filename: file.name,
      csv,
      inputHash,
      config,
      result,
      createUpload: true,
    });
    return json({ run: await getRun(runId) }, 201);
  } catch (error) {
    return internalError(
      error,
      'The run could not be created. Retry with the same source file.',
    );
  }
}
