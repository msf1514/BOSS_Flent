import { actorFromRequest, authorizeDealAccess } from '@/lib/auth';
import { internalError, json } from '@/lib/http';
import {
  classifyArtifact,
  deleteArtifact,
  ingestArtifact,
  listInventory,
  supersedeArtifact,
  type ArtifactKind,
  type Sensitivity,
} from '@/lib/evidence-registry';

export const dynamic = 'force-dynamic';

const KINDS: ArtifactKind[] = [
  'listing_csv',
  'deal_record',
  'comment_thread',
  'image',
  'document',
  'outcome_set',
  'reference_assessment',
];
const SENSITIVITIES: Sensitivity[] = [
  'standard',
  'financial',
  'personal',
  'restricted',
];
const dealIdPattern = /^[a-zA-Z0-9_-]{1,120}$/;

export async function GET(request: Request) {
  try {
    const actor = actorFromRequest(request);
    const dealId = new URL(request.url).searchParams.get('dealId')?.trim();
    if (!dealId || !dealIdPattern.test(dealId))
      return json({ error: 'A valid dealId query parameter is required.' }, 400);
    if (!authorizeDealAccess(actor, dealId))
      return json({ error: 'Sign in is required to view evidence.' }, 401);
    return json({ inventory: await listInventory(dealId) });
  } catch (error) {
    return internalError(error, 'The evidence inventory could not be loaded.');
  }
}

export async function POST(request: Request) {
  try {
    const actor = actorFromRequest(request);
    const form = await request.formData();
    const field = (key: string) => {
      const value = form.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    const dealId = field('dealId');
    if (!dealId || !dealIdPattern.test(dealId))
      return json({ error: 'A valid dealId is required.' }, 400);
    if (!authorizeDealAccess(actor, dealId))
      return json({ error: 'Sign in is required to add evidence.' }, 401);

    const file = form.get('file');
    if (!(file instanceof File))
      return json({ error: 'Attach a file to add to the packet.' }, 400);
    if (file.size === 0) return json({ error: 'The file is empty.' }, 400);

    const declaredKindRaw = field('kind');
    const declaredKind =
      declaredKindRaw && KINDS.includes(declaredKindRaw as ArtifactKind)
        ? (declaredKindRaw as ArtifactKind)
        : undefined;
    if (declaredKindRaw && !declaredKind)
      return json({ error: 'Unknown artifact kind.' }, 400);

    const sensitivityRaw = field('sensitivity');
    const sensitivity =
      sensitivityRaw && SENSITIVITIES.includes(sensitivityRaw as Sensitivity)
        ? (sensitivityRaw as Sensitivity)
        : undefined;

    // Enforce the declared/inferred type's size cap before reading bytes into
    // the registry. Unsupported files are still preserved (see registry), but
    // we cap them at the largest allowed size to bound abuse.
    const classification = classifyArtifact({
      filename: file.name,
      mimeType: file.type,
      declaredKind,
    });
    if (file.size > classification.maxBytes)
      return json(
        {
          error: `"${file.name}" exceeds the ${(classification.maxBytes / 1_000_000).toFixed(0)} MB limit for this file type.`,
        },
        413,
      );

    const result = await ingestArtifact({
      dealId,
      filename: file.name,
      mimeType: file.type,
      bytes: await file.arrayBuffer(),
      actor,
      declaredKind,
      sensitivity,
      sourceSystem: field('sourceSystem') || 'manual-upload',
      sourceReference: field('sourceReference'),
    });

    return json(
      {
        artifact: result.artifact,
        duplicate: result.duplicate,
        supported: result.classification.supported,
        reason: result.classification.reason,
      },
      result.duplicate ? 200 : 201,
    );
  } catch (error) {
    return internalError(
      error,
      'The artifact could not be added. Check the file and retry.',
    );
  }
}

const outcomeStatus = (reason: 'not_found' | 'invalid_state') =>
  reason === 'not_found' ? 404 : 409;

// PATCH: record that one artifact supersedes another (negotiation/correction
// history). Body: { dealId, supersededId, replacementId, note? }.
export async function PATCH(request: Request) {
  try {
    const actor = actorFromRequest(request);
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) return json({ error: 'A JSON body is required.' }, 400);
    const str = (key: string) =>
      typeof body[key] === 'string' ? (body[key] as string).trim() : '';

    const dealId = str('dealId');
    if (!dealId || !dealIdPattern.test(dealId))
      return json({ error: 'A valid dealId is required.' }, 400);
    if (!authorizeDealAccess(actor, dealId))
      return json({ error: 'Sign in is required to change evidence.' }, 401);

    const supersededId = str('supersededId');
    const replacementId = str('replacementId');
    if (!supersededId || !replacementId)
      return json(
        { error: 'supersededId and replacementId are both required.' },
        400,
      );

    const result = await supersedeArtifact({
      dealId,
      supersededId,
      replacementId,
      actor,
      note: str('note'),
    });
    if (!result.ok)
      return json(
        {
          error:
            result.reason === 'not_found'
              ? 'One or both artifacts were not found for this deal.'
              : 'These artifacts cannot supersede one another (different kind, already deleted, or same artifact).',
        },
        outcomeStatus(result.reason),
      );
    return json({ artifact: result.artifact, changed: result.changed });
  } catch (error) {
    return internalError(error, 'The supersession could not be recorded.');
  }
}

// DELETE: soft-delete an artifact (row and bytes preserved for audit).
// Query: ?dealId=...&artifactId=...&reason=...
export async function DELETE(request: Request) {
  try {
    const actor = actorFromRequest(request);
    const params = new URL(request.url).searchParams;
    const dealId = params.get('dealId')?.trim() ?? '';
    if (!dealId || !dealIdPattern.test(dealId))
      return json({ error: 'A valid dealId is required.' }, 400);
    if (!authorizeDealAccess(actor, dealId))
      return json({ error: 'Sign in is required to change evidence.' }, 401);

    const artifactId = params.get('artifactId')?.trim() ?? '';
    if (!artifactId)
      return json({ error: 'An artifactId is required.' }, 400);

    const result = await deleteArtifact({
      dealId,
      artifactId,
      actor,
      reason: params.get('reason')?.trim() ?? '',
    });
    if (!result.ok)
      return json(
        { error: 'Artifact not found for this deal.' },
        outcomeStatus(result.reason),
      );
    return json({ artifact: result.artifact, changed: result.changed });
  } catch (error) {
    return internalError(error, 'The artifact could not be deleted.');
  }
}
