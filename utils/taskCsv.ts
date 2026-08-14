// Bulk task CSV import/export: the shared column spec, parser, serializer,
// and validator used by the template download, the export button, and the
// import preview. Keeping all four fed from one column list here is what
// keeps them from drifting apart.

export interface TaskCsvContext {
  users: { id: string; username: string }[];
  departments: string[]; // display names, e.g. from settings.departments
  statuses: string[];
  priorities: string[];
  effortPoints: number[];
  /** Tasks already on the board, for resolving a Dependencies column to ids. */
  existingTasks?: { id: string; title: string }[];
}

export interface DraftTask {
  title: string;
  description: string;
  status: string;
  priority: string;
  effort?: number;
  departments: string[];
  assignees: string[]; // user ids (string, client-side convention)
  contributors: string[];
  successCriteria: { id: string; text: string; completed: boolean }[];
  startDate: string;
  dueDate: string;
  deptOnly: boolean;
  /** Resolved existing-task ids — dependencies already on the board. */
  dependencies: string[];
  /**
   * Exact titles of other rows in this same import that this row depends
   * on. Can't be turned into ids until the whole batch is inserted — the
   * server resolves these in a second pass within the same transaction.
   */
  dependencyTitles: string[];
}

export interface RowError {
  row: number; // 1-based, counting the header as row 0
  column: string;
  message: string;
}

export interface ParseResult {
  drafts: DraftTask[];
  /** Parallel to drafts: null if the row is clean, else the errors for that row. */
  rowErrors: (RowError[] | null)[];
  rowWarnings: (RowError[] | null)[];
}

export const TASK_CSV_HEADERS = [
  'Title',
  'Description',
  'Status',
  'Priority',
  'Effort',
  'Departments',
  'Assignees',
  'Contributors',
  'Start Date',
  'Due Date',
  'Success Criteria',
  'Dept Only',
  'Dependencies',
] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const norm = (s: string) => s.trim().toLowerCase();
const splitMulti = (s: string) => s.split(';').map(x => x.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// CSV parsing (RFC-4180-ish: quoted fields, "" escapes, embedded newlines and
// commas, tolerant of \r\n and a leading UTF-8 BOM).
// ---------------------------------------------------------------------------
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { pushField(); i++; continue; }
    if (c === '\r') { i++; continue; } // swallow, \n (or EOF) ends the row
    if (c === '\n') { pushRow(); i++; continue; }
    field += c; i++;
  }
  // Trailing field/row (file may or may not end with a newline).
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop a fully-blank trailing row (common with a trailing newline).
  while (rows.length > 0 && rows[rows.length - 1].every(c => c === '')) rows.pop();
  return rows;
}

// Escape a CSV cell, guarding against spreadsheet formula injection: a
// leading = + - @ (or tab/CR) is neutralized with a leading apostrophe.
// Mirrors server/routes/scout.ts's csvCell().
export function csvCell(v: any): string {
  if (v === null || v === undefined) return '';
  let s = Array.isArray(v) ? v.join('; ') : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: any[][]): string {
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------
export function buildTemplateCsv(ctx: Pick<TaskCsvContext, 'departments'>): string {
  const dept = ctx.departments[0] || 'Software';
  const rows: any[][] = [
    [...TASK_CSV_HEADERS],
    [
      'Wire up drivetrain motors', 'Connect and test all four drive motors', 'Not Started', 'High', 3,
      dept, '', '', '', '', 'Motors spin correct direction;Current draw within spec', 'no', '',
    ],
    [
      'Design intake CAD model', 'Draft the intake mechanism in CAD for review', 'Backlog', 'Medium', 5,
      dept, '', '', '', '', '', 'no', '',
    ],
    [
      'Order polycarbonate sheets', '', 'Not Started', 'Low', 1,
      dept, '', '', '', '', '', 'no', 'Design intake CAD model',
    ],
  ];
  return toCsv(rows);
}

export function buildAiInstructions(ctx: TaskCsvContext): string {
  return [
    'You are helping break a scope document into task-board cards for a CSV import.',
    'Output a CSV with EXACTLY this header row (same order, same spelling):',
    TASK_CSV_HEADERS.join(','),
    '',
    'Rules for each column:',
    '- Title: required, short and specific.',
    '- Description: optional, free text.',
    `- Status: one of ${ctx.statuses.join(', ')} (default "Not Started" if unsure).`,
    `- Priority: one of ${ctx.priorities.join(', ')} (default "Medium" if unsure).`,
    `- Effort: one of ${ctx.effortPoints.join(', ')} (rough relative sizing; leave blank if unsure).`,
    `- Departments: any of ${ctx.departments.join(', ')}, separated by semicolons if more than one.`,
    '- Assignees / Contributors: leave blank unless the source document names specific people by username.',
    '- Start Date / Due Date: YYYY-MM-DD, leave blank if not specified.',
    '- Success Criteria: short checklist items for "done", separated by semicolons.',
    '- Dept Only: "yes" or "no" (default "no").',
    '- Dependencies: titles of other tasks in THIS file that must finish first, separated by semicolons — use the exact Title text. Dependencies must not form a loop (e.g. A depends on B, B depends on A).',
    '',
    'Quote any field containing a comma. Do not invent people, dates, or departments not implied by the document.',
    'Return only the CSV, no commentary.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Import: rows -> validated draft tasks
// ---------------------------------------------------------------------------
export function rowsToDraftTasks(rows: string[][], ctx: TaskCsvContext): ParseResult {
  if (rows.length === 0) return { drafts: [], rowErrors: [], rowWarnings: [] };

  const header = rows[0].map(h => norm(h));
  const idx = (label: string) => header.indexOf(norm(label));
  const colIdx: Record<string, number> = {};
  for (const h of TASK_CSV_HEADERS) colIdx[h] = idx(h);

  const usersByName = new Map(ctx.users.map(u => [norm(u.username), u.id]));
  const deptByName = new Map(ctx.departments.map(d => [norm(d), d]));
  const statusByName = new Map(ctx.statuses.map(s => [norm(s), s]));
  const priorityByName = new Map(ctx.priorities.map(p => [norm(p), p]));
  const effortSet = new Set(ctx.effortPoints);

  const existingByTitle = new Map((ctx.existingTasks || []).map(t => [norm(t.title), t.id]));
  const seenInFile = new Set<string>();

  const dataRows = rows.slice(1);
  const cellAt = (raw: string[], label: string) => (colIdx[label] >= 0 ? (raw[colIdx[label]] ?? '') : '').trim();

  // Pre-pass: index every row's title so a Dependencies cell can resolve a
  // forward reference (a row naming a task listed later in the same file).
  const titles = dataRows.map(raw => cellAt(raw, 'Title'));
  const titleToRowIndices = new Map<string, number[]>();
  titles.forEach((t, i) => {
    if (!t) return;
    const key = norm(t);
    const list = titleToRowIndices.get(key) || [];
    list.push(i);
    titleToRowIndices.set(key, list);
  });

  const drafts: DraftTask[] = [];
  const rowErrorLists: RowError[][] = dataRows.map(() => []);
  const rowWarningLists: RowError[][] = dataRows.map(() => []);
  // Same-file dependency graph: edges[i] = row indices that row i depends on.
  const edges: number[][] = dataRows.map(() => []);

  for (let r = 0; r < dataRows.length; r++) {
    const raw = dataRows[r];
    const rowNum = r + 2; // 1-based with header as row 1
    const cell = (label: string) => cellAt(raw, label);
    const errors = rowErrorLists[r];
    const warnings = rowWarningLists[r];

    const title = titles[r];
    if (!title) errors.push({ row: rowNum, column: 'Title', message: 'Title is required.' });
    if (title && seenInFile.has(norm(title))) {
      warnings.push({ row: rowNum, column: 'Title', message: 'Duplicate title elsewhere in this file.' });
    }

    let status = 'Not Started';
    const statusRaw = cell('Status');
    if (statusRaw) {
      const match = statusByName.get(norm(statusRaw));
      if (!match) errors.push({ row: rowNum, column: 'Status', message: `Unrecognized status "${statusRaw}".` });
      else status = match;
    }

    let priority = 'Medium';
    const priorityRaw = cell('Priority');
    if (priorityRaw) {
      const match = priorityByName.get(norm(priorityRaw));
      if (!match) errors.push({ row: rowNum, column: 'Priority', message: `Unrecognized priority "${priorityRaw}".` });
      else priority = match;
    }

    let effort: number | undefined;
    const effortRaw = cell('Effort');
    if (effortRaw) {
      const n = Number(effortRaw);
      if (!Number.isFinite(n) || !effortSet.has(n)) {
        errors.push({ row: rowNum, column: 'Effort', message: `Effort must be one of ${[...effortSet].join(', ')}.` });
      } else effort = n;
    }

    const departments: string[] = [];
    for (const d of splitMulti(cell('Departments'))) {
      const match = deptByName.get(norm(d));
      if (!match) errors.push({ row: rowNum, column: 'Departments', message: `Unrecognized department "${d}".` });
      else departments.push(match);
    }

    const assignees: string[] = [];
    for (const a of splitMulti(cell('Assignees'))) {
      const match = usersByName.get(norm(a));
      if (!match) errors.push({ row: rowNum, column: 'Assignees', message: `Unknown username "${a}".` });
      else assignees.push(match);
    }

    const contributors: string[] = [];
    for (const c of splitMulti(cell('Contributors'))) {
      const match = usersByName.get(norm(c));
      if (!match) errors.push({ row: rowNum, column: 'Contributors', message: `Unknown username "${c}".` });
      else contributors.push(match);
    }

    const startDate = cell('Start Date');
    if (startDate && !DATE_RE.test(startDate)) {
      errors.push({ row: rowNum, column: 'Start Date', message: 'Use YYYY-MM-DD.' });
    }
    const dueDate = cell('Due Date');
    if (dueDate && !DATE_RE.test(dueDate)) {
      errors.push({ row: rowNum, column: 'Due Date', message: 'Use YYYY-MM-DD.' });
    }

    const successCriteria = splitMulti(cell('Success Criteria')).map((text, i) => ({
      id: `import-${rowNum}-${i}-${Date.now()}`, text, completed: false,
    }));

    const deptOnlyRaw = norm(cell('Dept Only'));
    const deptOnly = deptOnlyRaw === 'yes' || deptOnlyRaw === 'true' || deptOnlyRaw === 'y';
    if (deptOnlyRaw && !['yes', 'no', 'true', 'false', 'y', 'n'].includes(deptOnlyRaw)) {
      warnings.push({ row: rowNum, column: 'Dept Only', message: `"${cell('Dept Only')}" treated as "no".` });
    }

    // Dependencies: existing-board match wins first; otherwise resolve
    // against other rows in this same file (by title, forward refs allowed).
    // A name that fits none of those is dropped with a warning, not an error
    // — a missing dependency link still leaves an importable task.
    const dependencyNames = splitMulti(cell('Dependencies'));
    const dependencies: string[] = [];
    const dependencyTitles: string[] = [];
    for (const dep of dependencyNames) {
      const depNorm = norm(dep);
      if (title && depNorm === norm(title)) {
        errors.push({ row: rowNum, column: 'Dependencies', message: `A task can't depend on itself ("${dep}").` });
        continue;
      }
      const existingId = existingByTitle.get(depNorm);
      if (existingId) { dependencies.push(existingId); continue; }

      const candidates = (titleToRowIndices.get(depNorm) || []).filter(j => j !== r);
      if (candidates.length === 1) {
        dependencyTitles.push(titles[candidates[0]]);
        edges[r].push(candidates[0]);
      } else if (candidates.length > 1) {
        errors.push({ row: rowNum, column: 'Dependencies', message: `Multiple tasks in this file are named "${dep}" — can't tell which one this depends on.` });
      } else {
        warnings.push({ row: rowNum, column: 'Dependencies', message: `"${dep}" doesn't match any known task title — imported without this dependency link.` });
      }
    }

    if (title) seenInFile.add(norm(title));

    drafts.push({
      title, description: cell('Description'), status, priority, effort,
      departments, assignees, contributors, successCriteria,
      startDate, dueDate, deptOnly, dependencies, dependencyTitles,
    });
  }

  // Cycle detection over the same-file dependency graph: standard DFS with a
  // recursion-stack coloring. Every row on a discovered cycle gets an error
  // naming the loop; rows outside any cycle are unaffected. A row that
  // depends on itself was already caught above and never reaches this graph.
  const UNVISITED = 0, VISITING = 1, DONE = 2;
  const state = new Array(dataRows.length).fill(UNVISITED);
  const stack: number[] = [];
  const reportedCycleRows = new Set<number>();

  function visit(u: number) {
    state[u] = VISITING;
    stack.push(u);
    for (const v of edges[u]) {
      if (state[v] === VISITING) {
        const start = stack.indexOf(v);
        const cycle = stack.slice(start);
        const names = [...cycle.map(n => titles[n]), titles[v]];
        const message = `Circular dependency: ${names.join(' → ')}`;
        for (const n of cycle) {
          if (!reportedCycleRows.has(n)) {
            rowErrorLists[n].push({ row: n + 2, column: 'Dependencies', message });
            reportedCycleRows.add(n);
          }
        }
      } else if (state[v] === UNVISITED) {
        visit(v);
      }
    }
    stack.pop();
    state[u] = DONE;
  }
  for (let i = 0; i < dataRows.length; i++) {
    if (state[i] === UNVISITED) visit(i);
  }

  const rowErrors = rowErrorLists.map(e => (e.length ? e : null));
  const rowWarnings = rowWarningLists.map(w => (w.length ? w : null));
  return { drafts, rowErrors, rowWarnings };
}

// ---------------------------------------------------------------------------
// Export: tasks -> CSV rows
// ---------------------------------------------------------------------------
export interface ExportableTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  effort?: number;
  departments?: string[];
  assignees?: string[];
  contributors?: string[];
  successCriteria?: { text: string }[];
  startDate?: string;
  dueDate?: string;
  deptOnly?: boolean;
  dependencies?: string[]; // task ids
}

export function tasksToCsvRows(
  tasks: ExportableTask[],
  ctx: { users: { id: string; username: string }[]; tasksById?: Map<string, ExportableTask> },
): any[][] {
  const nameForUser = (id: string) => ctx.users.find(u => u.id === id)?.username || id;
  const titleForTask = (id: string) => ctx.tasksById?.get(id)?.title || id;

  const rows: any[][] = [[...TASK_CSV_HEADERS]];
  for (const t of tasks) {
    rows.push([
      t.title,
      t.description || '',
      t.status,
      t.priority,
      t.effort ?? '',
      (t.departments || []).join('; '),
      (t.assignees || []).map(nameForUser).join('; '),
      (t.contributors || []).map(nameForUser).join('; '),
      t.startDate || '',
      t.dueDate || '',
      (t.successCriteria || []).map((c: any) => c.text).join('; '),
      t.deptOnly ? 'yes' : 'no',
      (t.dependencies || []).map(titleForTask).join('; '),
    ]);
  }
  return rows;
}
