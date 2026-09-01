// Pure capture-boundary rules: which artifacts a packet expects, how an
// incoming file maps to a registry kind, and content hashing. No storage or
// network access lives here so it can be unit-tested directly.

export type ArtifactKind =
  | 'listing_csv'
  | 'deal_record'
  | 'comment_thread'
  | 'image'
  | 'document'
  | 'outcome_set'
  | 'reference_assessment'
  | 'unsupported';

export type Sensitivity = 'standard' | 'financial' | 'personal' | 'restricted';

export type ManifestEntry = {
  kind: ArtifactKind;
  label: string;
  packetSource: string;
  required: boolean;
  multiple: boolean;
  consumedByProblem1: boolean;
};

// What a complete BOSS case packet is expected to contain. Drives the
// received / missing view. `consumedByProblem1` records whether the market
// engine is *allowed* to read the artifact — the capture/calculate boundary.
export const PACKET_MANIFEST: ManifestEntry[] = [
  {
    kind: 'listing_csv',
    label: 'Comparable listings',
    packetSource: 'listings.csv',
    required: true,
    multiple: false,
    consumedByProblem1: true,
  },
  {
    kind: 'deal_record',
    label: 'Deal record & terms',
    packetSource: 'deal.md',
    required: true,
    multiple: false,
    consumedByProblem1: true, // subject facts + landlord ask only; reviewed first
  },
  {
    kind: 'comment_thread',
    label: 'Internal comments',
    packetSource: 'comments.md',
    required: false,
    multiple: true,
    consumedByProblem1: false,
  },
  {
    kind: 'image',
    label: 'Subject-property photos',
    packetSource: 'photos/',
    required: false,
    multiple: true,
    consumedByProblem1: false,
  },
  {
    kind: 'outcome_set',
    label: 'Historical outcomes',
    packetSource: 'outcomes.csv',
    required: false,
    multiple: false,
    consumedByProblem1: false, // Problem 2 only — never the current median
  },
  {
    kind: 'reference_assessment',
    label: 'Prior BOSS assessment',
    packetSource: 'boss-assessment.md',
    required: false,
    multiple: false,
    consumedByProblem1: false, // Problem 3 reference — leakage guard
  },
];

type AcceptedType = {
  extensions: string[];
  mimeTypes: string[];
  maxBytes: number;
  sensitivity: Sensitivity;
};

// Explicit accept policy. Anything outside this maps to `unsupported` and is
// still preserved and flagged — never silently ignored (acceptance criterion).
const ACCEPT: Record<string, AcceptedType> = {
  csv: {
    extensions: ['.csv'],
    mimeTypes: ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
    maxBytes: 5_000_000,
    sensitivity: 'standard',
  },
  markdown: {
    extensions: ['.md', '.markdown', '.txt'],
    mimeTypes: ['text/markdown', 'text/plain', 'text/x-markdown'],
    maxBytes: 2_000_000,
    sensitivity: 'financial',
  },
  image: {
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 15_000_000,
    sensitivity: 'personal',
  },
  document: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    maxBytes: 15_000_000,
    sensitivity: 'financial',
  },
};

const KINDS_FOR_GROUP: Record<string, ArtifactKind[]> = {
  csv: ['listing_csv', 'outcome_set'],
  markdown: ['deal_record', 'comment_thread', 'reference_assessment'],
  image: ['image'],
  document: ['document'],
};

const UNSUPPORTED_MAX_BYTES = 15_000_000;

const extensionOf = (filename: string) => {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
};

function acceptGroupFor(filename: string, mimeType: string) {
  const ext = extensionOf(filename);
  const mime = mimeType.split(';')[0].trim().toLowerCase();
  for (const [group, spec] of Object.entries(ACCEPT))
    if (spec.extensions.includes(ext) || spec.mimeTypes.includes(mime))
      return { group, spec };
  return null;
}

export type Classification = {
  kind: ArtifactKind;
  sensitivity: Sensitivity;
  supported: boolean;
  maxBytes: number;
  reason: string | null;
};

// Resolve an incoming file to a registry kind. A caller may *declare* the kind
// (the Import case-packet UI maps each file); we only honour a declared kind
// when the file's group can carry it, otherwise fall back to inference so a
// mislabelled upload is never trusted blindly.
export function classifyArtifact(input: {
  filename: string;
  mimeType: string;
  declaredKind?: ArtifactKind;
}): Classification {
  const match = acceptGroupFor(input.filename, input.mimeType);
  if (!match)
    return {
      kind: 'unsupported',
      sensitivity: 'restricted',
      supported: false,
      maxBytes: UNSUPPORTED_MAX_BYTES,
      reason: `Unsupported file type for "${input.filename}". It is preserved and flagged for manual triage.`,
    };

  const { group, spec } = match;
  const allowed = KINDS_FOR_GROUP[group];

  let kind: ArtifactKind;
  if (
    input.declaredKind &&
    input.declaredKind !== 'unsupported' &&
    allowed.includes(input.declaredKind)
  ) {
    kind = input.declaredKind;
  } else {
    const lower = input.filename.toLowerCase();
    if (group === 'csv')
      kind = lower.includes('outcome') ? 'outcome_set' : 'listing_csv';
    else if (group === 'markdown')
      kind = lower.includes('comment')
        ? 'comment_thread'
        : lower.includes('assessment')
          ? 'reference_assessment'
          : 'deal_record';
    else kind = allowed[0];
  }

  return {
    kind,
    sensitivity: spec.sensitivity,
    supported: true,
    maxBytes: spec.maxBytes,
    reason: null,
  };
}

export async function hashBytes(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
