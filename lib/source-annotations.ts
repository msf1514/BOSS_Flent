import type { EngineAnnotations } from '@/lib/evidence-engine';

// SHA-256 of public/anonymised-deal-sample.csv. The source-bound annotation below
// is applied ONLY when the uploaded bytes match this exact sample, so a re-key is
// required whenever the sample file itself changes (line endings included).
export const ANONYMISED_SAMPLE_SHA256 =
  'dde9604c8d3b0fdc49cddc0639ddd80b1a40e8118457a54cc7464e7ca0d520e5';

const SAMPLE_ANNOTATIONS: EngineAnnotations = {
  'CP-0081': ['attribute_conflict_candidate'],
};

export function sourceAnnotationsForHash(inputHash: string): EngineAnnotations {
  return inputHash.toLowerCase() === ANONYMISED_SAMPLE_SHA256
    ? SAMPLE_ANNOTATIONS
    : {};
}
