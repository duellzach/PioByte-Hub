// Shared scouting template model — the single source of truth for the flexible
// field system used by seasons/templates. Imported by both the server (schema
// migration, routes, storage) and the client (forms, analytics, QR, CSV).
//
// Design contract (mid-season resilience):
//   - Field keys are permanent and never reused; "deleting" a field archives it.
//   - Records store a full `data` blob keyed by field key; old blobs are never
//     rewritten, so archived field defs keep old values labeled.
//   - See docs/design/scouting-seasons-templates.md.

export type ScoutKind = 'pit' | 'match';

export type FieldType =
  | 'number'
  | 'counter'
  | 'boolean'
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'rating'   // 1..max stars
  | 'slider'   // 1..max range slider (built-ins use max 10)
  | 'photo';   // data-URL image

export interface TemplateField {
  key: string;            // stable, unique within a template
  label: string;
  type: FieldType;
  options?: string[];     // select / multiselect
  min?: number;           // counter / slider / rating
  max?: number;           // counter / slider / rating
  quickAdd?: number[];    // counter quick-add buttons, e.g. [5, 10]
  required?: boolean;
  section?: string;       // group heading in the form
  placeholder?: string;
  // Identity fields are locked in the builder: never archivable, always present.
  identity?: boolean;
  // A select whose options come from a runtime source (e.g. a team's pit auto
  // routines) rather than a fixed `options` list, and which allows free text.
  dynamicOptions?: 'pitAutoRoutines';
  allowCustom?: boolean;
  // Analytics hints (numeric/counter/rating/slider only):
  aggregate?: 'avg' | 'sum' | 'max' | 'none';
  showInSummary?: boolean; // show on the robot summary card
  rankMetric?: boolean;    // default sort/ranking metric
  // Soft-delete:
  archived?: boolean;
  archivedAt?: number;
}

export interface ScoutingTemplateShape {
  kind: ScoutKind;
  name: string;
  fields: TemplateField[];
}

/** Field types whose values are numeric and can be aggregated. */
export const NUMERIC_FIELD_TYPES: FieldType[] = ['number', 'counter', 'rating', 'slider'];

export function isNumericField(f: TemplateField): boolean {
  return NUMERIC_FIELD_TYPES.includes(f.type);
}

// ---------------------------------------------------------------------------
// Built-in templates — mirror the legacy hard-coded forms exactly so that the
// backfilled `data` blob maps 1:1 to the old columns and day-one behavior is
// unchanged. Field `key` == the legacy column name. Columns the live forms no
// longer collect enter as `archived` fields (kept for old rows + CSV history).
// ---------------------------------------------------------------------------

export const BUILTIN_PIT_FIELDS: TemplateField[] = [
  { key: 'teamNumber', label: 'Team Number', type: 'number', identity: true, required: true, section: 'Identity' },
  { key: 'drivetrain', label: 'Drivetrain', type: 'select', options: ['Tank', 'Swerve', 'Mecanum', 'Other'], section: 'Robot' },
  { key: 'autonomousRoutine', label: 'Autonomous Routine', type: 'textarea', section: 'Autonomous', placeholder: 'Describe autonomous routine…' },
  { key: 'capabilities', label: 'Capabilities', type: 'multiselect', section: 'Robot', placeholder: 'Add capability and press Enter' },
  { key: 'deficiencies', label: 'Weaknesses / Deficiencies', type: 'multiselect', section: 'Robot', placeholder: 'Add weakness and press Enter' },
  { key: 'notes', label: 'Notes', type: 'textarea', section: 'Notes', placeholder: 'Additional observations…' },
  { key: 'photoUrl', label: 'Robot Photo', type: 'photo', section: 'Robot' },
  { key: 'offenseRating', label: 'Offense Rating', type: 'slider', min: 1, max: 10, aggregate: 'avg', showInSummary: true, section: 'Ratings' },
  { key: 'defenseRating', label: 'Defense Rating', type: 'slider', min: 1, max: 10, aggregate: 'avg', showInSummary: true, section: 'Ratings' },
  { key: 'overallRating', label: 'Overall Rating', type: 'slider', min: 1, max: 10, aggregate: 'avg', showInSummary: true, rankMetric: true, section: 'Ratings' },
  { key: 'coreValuesRating', label: 'Alliance Interest', type: 'rating', max: 3, aggregate: 'avg', section: 'Ratings' },
  // Archived — legacy columns the current pit form does not collect.
  { key: 'teamName', label: 'Team Name', type: 'text', archived: true },
  { key: 'robotName', label: 'Robot Name', type: 'text', archived: true },
  { key: 'weight', label: 'Weight', type: 'number', archived: true },
  { key: 'speed', label: 'Speed', type: 'number', archived: true },
  { key: 'height', label: 'Height', type: 'number', archived: true },
  { key: 'fuelCapacity', label: 'Fuel Capacity', type: 'number', archived: true },
  { key: 'traversalAbility', label: 'Traversal Ability', type: 'text', archived: true },
  { key: 'shooterType', label: 'Shooter Type', type: 'text', archived: true },
  { key: 'autoOptions', label: 'Auto Options', type: 'multiselect', archived: true },
];

export const BUILTIN_MATCH_FIELDS: TemplateField[] = [
  { key: 'matchNumber', label: 'Match Number', type: 'number', identity: true, required: true, section: 'Match' },
  { key: 'matchType', label: 'Match Type', type: 'select', options: ['practice', 'qualification', 'elimination'], identity: true, section: 'Match' },
  { key: 'teamNumber', label: 'Team Number', type: 'number', identity: true, required: true, section: 'Match' },
  { key: 'alliance', label: 'Alliance', type: 'select', options: ['Red', 'Blue'], identity: true, section: 'Match' },
  { key: 'autoUsed', label: 'Auto Routine Used', type: 'select', dynamicOptions: 'pitAutoRoutines', allowCustom: true, section: 'Autonomous' },
  { key: 'autoFuelTotal', label: 'Auto Period Fuel', type: 'counter', min: 0, quickAdd: [5, 10], aggregate: 'avg', showInSummary: true, section: 'Auto' },
  { key: 'teleopFuelTotal', label: 'Tele-Op Period Fuel', type: 'counter', min: 0, quickAdd: [5, 10], aggregate: 'avg', showInSummary: true, rankMetric: true, section: 'Tele-Op' },
  { key: 'coralScored', label: 'Fuel Accuracy (1 = always misses → 5 = always hits)', type: 'rating', max: 5, aggregate: 'avg', showInSummary: true, section: 'Scoring' },
  { key: 'endClimbLevel', label: 'Climb Level (0 = no climb)', type: 'counter', min: 0, max: 3, aggregate: 'avg', showInSummary: true, section: 'Endgame' },
  { key: 'penalties', label: 'Penalties', type: 'counter', min: 0, aggregate: 'avg', section: 'Match' },
  { key: 'drivingSkillRating', label: 'Driving Skill Rating', type: 'rating', max: 5, aggregate: 'avg', section: 'Ratings' },
  { key: 'notes', label: 'Notes', type: 'textarea', section: 'Notes', placeholder: 'Match observations…' },
  // Archived — legacy columns the current match form does not collect.
  { key: 'autoScore', label: 'Auto Score', type: 'number', archived: true },
  { key: 'teleopScore', label: 'Teleop Score', type: 'number', archived: true },
  { key: 'endgameScore', label: 'Endgame Score', type: 'number', archived: true },
  { key: 'algaeScored', label: 'Algae Scored', type: 'number', archived: true },
  { key: 'autoClimb', label: 'Auto Climb', type: 'boolean', archived: true },
  { key: 'humanPlayerScore', label: 'Human Player Score', type: 'number', archived: true },
  { key: 'matchDefenseRating', label: 'Defense Rating (legacy)', type: 'rating', max: 3, archived: true },
  { key: 'matchCoreValuesRating', label: 'Core Values (legacy)', type: 'rating', max: 3, archived: true },
];

export const BUILTIN_TEMPLATES: Record<ScoutKind, ScoutingTemplateShape> = {
  pit: { kind: 'pit', name: 'Built-in Pit (Legacy)', fields: BUILTIN_PIT_FIELDS },
  match: { kind: 'match', name: 'Built-in Match (Legacy)', fields: BUILTIN_MATCH_FIELDS },
};

// The two legacy match columns `defense_rating` / `core_values_rating` collide
// by camelCase name with pit keys but, more importantly, are not collected by
// the live match form. Their data-blob keys differ from the DB column so the
// mapping below is explicit rather than a blind 1:1 for those two.
const MATCH_LEGACY_KEY_TO_COLUMN: Record<string, string> = {
  matchDefenseRating: 'defenseRating',
  matchCoreValuesRating: 'coreValuesRating',
};
const MATCH_COLUMN_TO_LEGACY_KEY: Record<string, string> = {
  defenseRating: 'matchDefenseRating',
  coreValuesRating: 'matchCoreValuesRating',
};

/** Field keys (active + archived) for a built-in kind, in template order. */
export function builtinFieldKeys(kind: ScoutKind): string[] {
  return BUILTIN_TEMPLATES[kind].fields.map(f => f.key);
}

// Row meta columns that are NOT part of the field `data` blob.
const META_COLUMNS = new Set([
  'id', 'eventId', 'scoutedBy', 'createdAt', 'updatedAt', 'templateId', 'data',
]);

/**
 * Build the `data` blob for a legacy scout row by reading its columns. Keys of
 * the blob are the built-in field keys; values come straight from the matching
 * column (with the two remapped match columns handled explicitly). Undefined
 * columns are skipped so the blob stays sparse and honest.
 */
export function dataFromLegacyRow(kind: ScoutKind, row: Record<string, any>): Record<string, any> {
  const data: Record<string, any> = {};
  for (const field of BUILTIN_TEMPLATES[kind].fields) {
    const column = kind === 'match' && MATCH_LEGACY_KEY_TO_COLUMN[field.key]
      ? MATCH_LEGACY_KEY_TO_COLUMN[field.key]
      : field.key;
    if (row[column] !== undefined && row[column] !== null && !META_COLUMNS.has(column)) {
      data[field.key] = row[column];
    }
  }
  return data;
}

/**
 * Inverse of dataFromLegacyRow: derive legacy column values from a `data` blob
 * for the built-in template, so writes can dual-write legacy columns (rollback
 * safety) during the transition. Only known built-in keys are mapped; unknown
 * (custom-template) keys are ignored here and live only in `data`.
 */
export function legacyColumnsFromData(kind: ScoutKind, data: Record<string, any>): Record<string, any> {
  const cols: Record<string, any> = {};
  if (!data) return cols;
  for (const field of BUILTIN_TEMPLATES[kind].fields) {
    if (data[field.key] === undefined) continue;
    const column = kind === 'match' && MATCH_LEGACY_KEY_TO_COLUMN[field.key]
      ? MATCH_LEGACY_KEY_TO_COLUMN[field.key]
      : field.key;
    cols[column] = data[field.key];
  }
  return cols;
}

export { MATCH_COLUMN_TO_LEGACY_KEY };

// ---------------------------------------------------------------------------
// Template edit validation — enforces the mid-season resilience contract.
// ---------------------------------------------------------------------------

/** Identity field keys that must always be present and are never archivable. */
export const IDENTITY_KEYS: Record<ScoutKind, string[]> = {
  pit: ['teamNumber'],
  match: ['matchNumber', 'matchType', 'teamNumber', 'alliance'],
};

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export interface TemplateValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Validate a proposed set of fields for a template of `kind`. When `previous`
 * is provided (an edit), enforces append-only: no previously-saved key may be
 * dropped, and a saved key's `type` may not change. Archiving (setting
 * archived:true) is allowed; removing the entry entirely is not.
 */
export function validateTemplateFields(
  kind: ScoutKind,
  fields: TemplateField[],
  previous?: TemplateField[],
): TemplateValidationResult {
  if (!Array.isArray(fields)) return { ok: false, error: 'fields must be an array' };

  const seen = new Set<string>();
  for (const f of fields) {
    if (!f || typeof f.key !== 'string' || !KEY_RE.test(f.key)) {
      return { ok: false, error: `Invalid field key: ${JSON.stringify(f?.key)}` };
    }
    if (seen.has(f.key)) return { ok: false, error: `Duplicate field key: ${f.key}` };
    seen.add(f.key);
    if (typeof f.label !== 'string' || !f.label.trim()) {
      return { ok: false, error: `Field ${f.key} needs a label` };
    }
  }

  // Identity fields must be present and not archived.
  for (const idKey of IDENTITY_KEYS[kind]) {
    const f = fields.find(x => x.key === idKey);
    if (!f) return { ok: false, error: `Missing required identity field: ${idKey}` };
    if (f.archived) return { ok: false, error: `Identity field cannot be archived: ${idKey}` };
  }

  if (previous) {
    const byKey = new Map(fields.map(f => [f.key, f]));
    for (const prev of previous) {
      const next = byKey.get(prev.key);
      if (!next) {
        return { ok: false, error: `Field "${prev.key}" cannot be removed — archive it instead` };
      }
      if (next.type !== prev.type) {
        return { ok: false, error: `Field "${prev.key}" type cannot change (${prev.type} → ${next.type})` };
      }
    }
  }

  return { ok: true };
}

/** Generate a stable snake_case key from a label, uniquified against `taken`. */
export function keyFromLabel(label: string, taken: Set<string> = new Set()): string {
  let base = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!base || !/^[a-z]/.test(base)) base = `field_${base}`;
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;
  return key;
}
