import { actorFromRequest } from '@/lib/auth';
import { internalError, json } from '@/lib/http';
import { inspectEvidenceSource } from '@/lib/source-inspection';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (!actorFromRequest(request))
      return json({ error: 'Sign in is required to inspect a source.' }, 401);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File))
      return json({ error: 'Choose a CSV file to inspect.' }, 400);
    if (!file.name.toLowerCase().endsWith('.csv'))
      return json({ error: 'Only .csv files are accepted.' }, 415);
    if (file.size > 2_000_000)
      return json({ error: 'CSV must be 2 MB or smaller.' }, 413);
    const inspection = await inspectEvidenceSource({
      filename: file.name,
      sizeBytes: file.size,
      csv: await file.text(),
    });
    return json({ inspection });
  } catch (error) {
    return internalError(
      error,
      'The source could not be inspected. Check the file and retry.',
    );
  }
}
