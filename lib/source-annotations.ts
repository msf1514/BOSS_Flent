import type { EngineAnnotations } from '@/lib/evidence-engine';

export const ANONYMISED_SAMPLE_SHA256 =
  '561c4abbf7aecc7b68b17a5a68ba79c57bbcb13c8d3f5584b454b5c90aed507f';

const SAMPLE_ANNOTATIONS: EngineAnnotations = {
  'CP-0081': ['attribute_conflict_candidate'],
};

export function sourceAnnotationsForHash(inputHash: string): EngineAnnotations {
  return inputHash.toLowerCase() === ANONYMISED_SAMPLE_SHA256
    ? SAMPLE_ANNOTATIONS
    : {};
}
