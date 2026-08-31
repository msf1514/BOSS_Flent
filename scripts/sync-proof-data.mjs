import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const proofRoot = resolve(root, '..', '..', 'outputs', 'BOSS_Problem1_Proof');
const generatedRoot = join(proofRoot, 'generated');

const readText = (path) => readFile(path, 'utf8');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const round1 = (value) => Math.round(value * 10) / 10;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...records] = rows.filter((record) => record.some(Boolean));
  return records.map((record) =>
    Object.fromEntries(
      headers.map((header, index) => [header, record[index] ?? '']),
    ),
  );
}

function scenario({
  id,
  label,
  plannedTenantRevenue,
  occupancy,
  baseRent,
  maintenance,
  landlordDeposit,
  tenantDeposits,
  capex,
  assertionState,
  note,
}) {
  const occupancyAdjustedRevenue = plannedTenantRevenue * occupancy;
  const monthlyOwnerCost = baseRent + maintenance;
  const monthlyContribution = occupancyAdjustedRevenue - monthlyOwnerCost;
  const uncoveredDeposit = Math.max(landlordDeposit - tenantDeposits, 0);
  const capitalEmployed = capex + uncoveredDeposit;
  return {
    id,
    label,
    plannedTenantRevenue,
    occupancy,
    occupancyAdjustedRevenue,
    baseRent,
    maintenance,
    monthlyOwnerCost,
    monthlyContribution,
    landlordDeposit,
    tenantDeposits,
    uncoveredDeposit,
    capex,
    capitalEmployed,
    simplePaybackMonths:
      monthlyContribution > 0
        ? round1(capitalEmployed / monthlyContribution)
        : null,
    assertionState,
    verificationState: 'not_verified',
    decisionGrade: false,
    model: 'STATIC SIMPLE PAYBACK — DIRECTIONAL, NOT DECISION-GRADE',
    omissionCodes: [
      'first_fill_vacancy',
      'rent_escalation',
      'exit_painting',
      'central_operating_costs',
    ],
    note,
  };
}

const summaryText = await readText(join(generatedRoot, 'summary.json'));
const auditText = await readText(join(generatedRoot, 'row_audit.csv'));
const policyText = await readText(join(proofRoot, 'policy.json'));
const analysisCode = await readText(join(proofRoot, 'analyze.py'));
const listingsInput = await readText(join(proofRoot, 'input', 'listings.csv'));
const summary = JSON.parse(summaryText);
const policy = JSON.parse(policyText);
const audit = parseCsv(auditText);

const listings = audit.map((row) => ({
  listingId: row.listing_id,
  observed: {
    source: row.source,
    society: row.society,
    bhk: Number(row.bhk),
    furnishing: row.furnishing,
    areaSqft: row.area_sqft ? Number(row.area_sqft) : null,
    rentInr: Number(row.rent),
    lastSeenDate: row.last_seen_date,
  },
  derived: {
    societyFamily: row.society_family,
    furnishingNormalized: row.furnishing_normalized,
    lastSeenAgeDays: Number(row.last_seen_age_days),
  },
  decision: {
    b0State: row.b0_state,
    b1State: row.b1_state,
    b2State: row.b2_state,
    duplicateGroup: row.duplicate_group || null,
    representativeListingId: row.representative_listing_id || null,
    effectiveWeight: Number(row.effective_weight_b2),
    reasonCodes: row.reasons ? row.reasons.split(';') : [],
    annotationType: row.annotation_type || null,
    annotationSource: row.annotation_source || null,
  },
}));

const opening = scenario({
  id: 'opening_ask',
  label: 'Opening terms',
  plannedTenantRevenue: 72000,
  occupancy: 0.95,
  baseRent: 56000,
  maintenance: 5000,
  landlordDeposit: 280000,
  tenantDeposits: 180000,
  capex: 160000,
  assertionState: 'mixed_recorded_and_estimated',
  note: 'Matches the supplied exercise assessment.',
});
const verbal = scenario({
  id: 'verbal_54000',
  label: 'Verbal ₹54k alternative',
  plannedTenantRevenue: 72000,
  occupancy: 0.95,
  baseRent: 54000,
  maintenance: 5000,
  landlordDeposit: 280000,
  tenantDeposits: 180000,
  capex: 160000,
  assertionState: 'unconfirmed_and_time_sensitive',
  note: 'The landlord alternative was verbal and conditional on signing that week; it is not live.',
});
const downside = scenario({
  id: 'room_2_downside_fixed_deposit',
  label: 'Room 2 at ₹31k · fixed deposit assumption',
  plannedTenantRevenue: 69000,
  occupancy: 0.95,
  baseRent: 56000,
  maintenance: 5000,
  landlordDeposit: 280000,
  tenantDeposits: 180000,
  capex: 160000,
  assertionState: 'estimated',
  note: 'Matches the supplied 57.1-month exercise scenario; tenant deposits remain fixed at ₹1.80L.',
});
const linkedDeposit = scenario({
  id: 'room_2_downside_linked_deposit',
  label: 'Room 2 at ₹31k · deposit linked to revenue',
  plannedTenantRevenue: 69000,
  occupancy: 0.95,
  baseRent: 56000,
  maintenance: 5000,
  landlordDeposit: 280000,
  tenantDeposits: 172500,
  capex: 160000,
  assertionState: 'candidate_sensitivity',
  note: 'Candidate sensitivity if the 2.5-month tenant-deposit assumption moves with revenue.',
});

const expectedPaybacks = new Map([
  ['opening_ask', 35.1],
  ['verbal_54000', 27.7],
  ['room_2_downside_fixed_deposit', 57.1],
  ['room_2_downside_linked_deposit', 58.8],
]);
for (const item of [opening, verbal, downside, linkedDeposit]) {
  if (item.simplePaybackMonths !== expectedPaybacks.get(item.id)) {
    throw new Error(
      `Economics contract mismatch for ${item.id}: ${item.simplePaybackMonths}`,
    );
  }
}

const contract = {
  schemaVersion: '1.0.0',
  snapshot: {
    caseId: 'FLT-FDE-2026-01',
    evidenceCutoff: summary.evidence_cutoff,
    snapshotTime: '2026-08-18T17:00:00+05:30',
    policyVersion: summary.policy_version,
    calculationVersion: sha256(analysisCode).slice(0, 12),
    inputHash: sha256(listingsInput).slice(0, 12),
    outputHash: sha256(`${summaryText}\n${auditText}`).slice(0, 12),
    isLive: false,
    isProduction: false,
  },
  case: {
    subject: {
      society: 'Lakeview Residences',
      societyFamily: summary.subject.society_family,
      bhk: summary.subject.bhk,
      areaSqft: summary.subject.area_sqft,
      furnishing: summary.subject.furnishing,
    },
    referenceDecision: {
      status: 'PROVISIONAL_HOLD',
      source: 'boss-assessment.md',
      generatedByPrototype: false,
      isProductionVerdict: false,
      ownerRole: 'Acquisition Lead',
      reason: 'Resolve market, landlord, capex and demand evidence.',
    },
  },
  marketEvidence: {
    ...summary,
    bandSemantics: 'middle_50_pct_of_retained_asking_prices',
    askingConfidenceSemantics: 'candidate_policy_conditional_stability_grade',
    isProbability: false,
    claimsSourceIndependence: false,
  },
  policy: {
    ...policy,
    authority: 'candidate_proposal',
    isFlentProductionPolicy: false,
    sensitivityLocation: 'analyze.py',
  },
  listings,
  economics: {
    source: 'boss-assessment.md',
    numericallyConsumesMarketEstimate: false,
    marketLinkageStatus:
      'unresolved_until_rent_basis_and_decision_policy_are_declared',
    scenarios: [opening, verbal, downside, linkedDeposit],
  },
  evidenceResolutionQueue: [
    {
      id: 'written_owner_terms',
      issue: 'Written ₹54k landlord alternative',
      owner: 'Supply',
      status: 'open',
      consequence: 'Owner-cost scenario remains unconfirmed.',
      requiredProof: 'Written landlord confirmation with validity date.',
    },
    {
      id: 'vendor_boq',
      issue: 'Vendor BOQ and technical checks',
      owner: 'Property',
      status: 'open',
      consequence: '₹1.60L capex and payback remain provisional.',
      requiredProof: 'Costed BOQ plus inspection sign-off.',
    },
    {
      id: 'tenant_price',
      issue: 'Room-price and fill evidence',
      owner: 'Demand / Pricing',
      status: 'open',
      consequence: '₹72k tenant revenue and vacancy assumptions are estimates.',
      requiredProof: 'Signed booking or cited comparable enquiry cohort.',
    },
    {
      id: 'maintenance_basis',
      issue: 'Listing maintenance basis',
      owner: 'Market Operations',
      status: 'blocked',
      consequence: 'Market-to-owner comparison is not decision-grade.',
      requiredProof:
        'Source-level maintenance inclusion evidence or explicit abstention.',
    },
    {
      id: 'sharing_rules',
      issue: 'Society sharing rules',
      owner: 'Supply / Property',
      status: 'open',
      consequence: 'Could force PASS regardless of market evidence.',
      requiredProof: 'Written society rule confirmation.',
    },
    {
      id: 'economics_review',
      issue: 'Static economics review',
      owner: 'Finance',
      status: 'open',
      consequence: 'Deposit dependency and omitted costs remain unresolved.',
      requiredProof: 'Reviewed assumptions and time-based cash-flow treatment.',
    },
  ],
  failureStates: [
    {
      id: 'rent_basis_unresolved',
      claim: 'Decision-grade comparison of market evidence with owner cost',
      state: 'INSUFFICIENT',
      reasons: [
        'maintenance_basis_unresolved',
        'asking_rent_is_not_achieved_rent',
      ],
      nextAction: 'Resolve source basis or retain the abstention.',
    },
  ],
  limitations: [
    'Single-case demonstrator; not a validated production trust layer.',
    'Society-family normalization uses candidate-authored prefix aliases.',
    'Duplicate candidates are exact material-field matches and are not ground truth.',
    'CP-0081 is a packet-grounded manual annotation, not general algorithmic detection.',
    'Review-pending records receive zero active weight until resolved.',
  ],
};

await mkdir(join(root, 'data'), { recursive: true });
await writeFile(
  join(root, 'data', 'prototype.json'),
  `${JSON.stringify(contract, null, 2)}\n`,
  'utf8',
);
console.log(`Wrote data/prototype.json with ${listings.length} listings.`);
