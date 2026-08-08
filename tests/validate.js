#!/usr/bin/env node
/**
 * CISSP data validation tests
 *
 * Checks every YAML data file for:
 *   - Parse errors (catches malformed YAML like indentation bugs)
 *   - Non-zero question/flashcard counts per domain
 *   - Required fields on every question
 *   - correct_answer in range 0-3
 *   - No duplicate IDs within or across files
 *
 * Exit 0 = all pass, exit 1 = one or more failures.
 */

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function pass(msg) { console.log(`  PASS  ${msg}`); passed++; }
function fail(msg) { console.error(`  FAIL  ${msg}`); failed++; }
function check(ok, msg) { ok ? pass(msg) : fail(msg); }

// ── domains.yml ───────────────────────────────────────────────
console.log('\n=== domains.yml ===');
let domains = [];
try {
  const data = yaml.load(fs.readFileSync(path.join(ROOT, 'data/domains.yml'), 'utf8'));
  domains = data.domains || [];
  pass('parses as valid YAML');
} catch (e) {
  fail(`parse error: ${e.message}`);
  process.exit(1); // nothing else can run without domain list
}

check(domains.length === 8, `8 domains defined (got ${domains.length})`);

// Domain weights drive the readiness score and mock exam composition, so they
// must match the published ISC2 exam outline. Update these expectations (and
// data/domains.yml) when ISC2 publishes a new outline after a Job Task Analysis.
// Current source: CISSP Certification Exam Outline effective April 15, 2024.
const EXPECTED_WEIGHTS = {
  domain1: 16, domain2: 10, domain3: 13, domain4: 13,
  domain5: 13, domain6: 12, domain7: 13, domain8: 10
};
{
  const totalWeight = domains.reduce((sum, d) => sum + (d.weight || 0), 0);
  check(totalWeight === 100, `domain weights sum to 100 (got ${totalWeight})`);
  const mismatched = domains.filter(d => d.weight !== EXPECTED_WEIGHTS[d.id]);
  check(mismatched.length === 0,
    `domain weights match the April 2024 ISC2 exam outline${
      mismatched.length ? ` (mismatched: ${mismatched.map(d => `${d.id}=${d.weight}, expected ${EXPECTED_WEIGHTS[d.id]}`).join('; ')})` : ''}`);
}

const domainIds = new Set(domains.map(d => d.id));
domains.forEach((d, i) => {
  check(!!d.id,   `domain[${i}] has id`);
  check(!!d.name, `domain[${i}] has name`);
});

// ── question files ────────────────────────────────────────────
const allQuestionIds = new Set();
const VALID_COGNITIVE_LEVELS = ['recall', 'applied'];
const cognitiveTotals = { recall: 0, applied: 0, untagged: 0 };

for (const domain of domains) {
  const file     = `data/questions/${domain.id}.yml`;
  const fullPath = path.join(ROOT, file);
  console.log(`\n=== ${file} ===`);

  let questions = [];
  try {
    const data = yaml.load(fs.readFileSync(fullPath, 'utf8'));
    questions = data.questions || [];
    pass('parses as valid YAML');
  } catch (e) {
    fail(`parse error: ${e.message}`);
    continue; // skip structural checks — file didn't load
  }

  check(questions.length > 0, `has at least 1 question (got ${questions.length})`);

  // Per-question structural checks
  let structErrors = 0;
  for (const q of questions) {
    const id = q.id || '(missing id)';

    if (!q.id)                                            { fail(`${id}: missing id`);             structErrors++; }
    if (q.domain !== domain.id)                           { fail(`${id}: domain field "${q.domain}" should be "${domain.id}"`); structErrors++; }
    if (!q.question)                                      { fail(`${id}: missing question text`);  structErrors++; }
    if (!Array.isArray(q.options) || q.options.length !== 4) { fail(`${id}: must have exactly 4 options (got ${(q.options || []).length})`); structErrors++; }
    if (q.correct_answer === undefined || q.correct_answer === null) { fail(`${id}: missing correct_answer`); structErrors++; }
    else if (q.correct_answer < 0 || q.correct_answer > 3)           { fail(`${id}: correct_answer ${q.correct_answer} out of range 0-3`); structErrors++; }
    if (!q.explanations || !q.explanations.correct)       { fail(`${id}: missing explanations.correct`); structErrors++; }

    if (q.cognitive_level === undefined || q.cognitive_level === null) {
      cognitiveTotals.untagged++;
    } else if (!VALID_COGNITIVE_LEVELS.includes(q.cognitive_level)) {
      fail(`${id}: invalid cognitive_level "${q.cognitive_level}"`); structErrors++;
    } else {
      cognitiveTotals[q.cognitive_level]++;
    }

    // Cross-file duplicate ID check
    if (q.id) {
      if (allQuestionIds.has(q.id)) { fail(`${id}: duplicate question id across files`); structErrors++; }
      else allQuestionIds.add(q.id);
    }
  }

  // Every question must be answerable as its stated id format so progress
  // tracking stays consistent across files.
  const badIds = questions.filter(q => q.id && !/^q-d\d+-\d+$/.test(q.id));
  check(badIds.length === 0,
    `all question ids follow the q-d<domain>-<number> format${badIds.length ? ` (bad: ${badIds.map(q => q.id).join(', ')})` : ''}`);

  if (structErrors === 0) {
    pass(`all ${questions.length} questions pass structural checks`);
  }
}

// ── cognitive-level coverage ──────────────────────────────────
// The real exam is dominated by applied/scenario judgment rather than recall,
// so a bank that skews heavily to recall will overstate a candidate's readiness.
console.log('\n=== cognitive level coverage ===');
{
  const tagged = cognitiveTotals.recall + cognitiveTotals.applied;
  check(cognitiveTotals.untagged === 0,
    `every question has a cognitive_level (${cognitiveTotals.untagged} untagged)`);
  const appliedPct = tagged > 0 ? Math.round((cognitiveTotals.applied / tagged) * 100) : 0;
  console.log(`  INFO  ${cognitiveTotals.applied} applied / ${cognitiveTotals.recall} recall (${appliedPct}% applied)`);
  check(appliedPct >= 30, `at least 30% of questions are applied/scenario (got ${appliedPct}%)`);
}

// ── flashcard files ───────────────────────────────────────────
const allFlashcardIds = new Set();

for (const domain of domains) {
  const file     = `data/flashcards/${domain.id}.yml`;
  const fullPath = path.join(ROOT, file);
  console.log(`\n=== ${file} ===`);

  let flashcards = [];
  try {
    const data = yaml.load(fs.readFileSync(fullPath, 'utf8'));
    flashcards = data.flashcards || [];
    pass('parses as valid YAML');
  } catch (e) {
    fail(`parse error: ${e.message}`);
    continue;
  }

  check(flashcards.length > 0, `has at least 1 flashcard (got ${flashcards.length})`);

  let structErrors = 0;
  for (const fc of flashcards) {
    const id = fc.id || '(missing id)';
    if (!fc.id)         { fail(`${id}: missing id`);         structErrors++; }
    if (!fc.term)       { fail(`${id}: missing term`);       structErrors++; }
    if (!fc.definition) { fail(`${id}: missing definition`); structErrors++; }
    if (fc.id) {
      if (allFlashcardIds.has(fc.id)) { fail(`${id}: duplicate flashcard id`); structErrors++; }
      else allFlashcardIds.add(fc.id);
    }
  }
  if (structErrors === 0) {
    pass(`all ${flashcards.length} flashcards pass structural checks`);
  }
}

// ── topic files ────────────────────────────────────────────────
const allTopicIds = new Set();
const VALID_BLOCK_TYPES = ['paragraph', 'list', 'callout'];
const VALID_CALLOUT_STYLES = ['tip', 'warning', 'example'];

for (const domain of domains) {
  const file     = `data/topics/${domain.id}.yml`;
  const fullPath = path.join(ROOT, file);
  console.log(`\n=== ${file} ===`);

  let topics = [];
  try {
    const data = yaml.load(fs.readFileSync(fullPath, 'utf8'));
    topics = data.topics || [];
    pass('parses as valid YAML');
  } catch (e) {
    fail(`parse error: ${e.message}`);
    continue;
  }

  check(topics.length > 0, `has at least 1 topic (got ${topics.length})`);

  let structErrors = 0;
  for (const t of topics) {
    const id = t.id || '(missing id)';

    if (!t.id)     { fail(`${id}: missing id`);     structErrors++; }
    if (t.domain !== domain.id) { fail(`${id}: domain field "${t.domain}" should be "${domain.id}"`); structErrors++; }
    if (!t.number) { fail(`${id}: missing number`); structErrors++; }
    if (!t.title)  { fail(`${id}: missing title`);  structErrors++; }

    if (!Array.isArray(t.sections) || t.sections.length === 0) {
      fail(`${id}: must have at least 1 section`); structErrors++;
    } else {
      t.sections.forEach((s, i) => {
        if (!s.heading) { fail(`${id}: section[${i}] missing heading`); structErrors++; }
        if (!Array.isArray(s.blocks) || s.blocks.length === 0) {
          fail(`${id}: section[${i}] must have at least 1 block`); structErrors++;
        } else {
          s.blocks.forEach((b, j) => {
            if (!VALID_BLOCK_TYPES.includes(b.type)) {
              fail(`${id}: section[${i}].blocks[${j}] invalid type "${b.type}"`); structErrors++;
            } else if (b.type === 'list' && (!Array.isArray(b.items) || b.items.length === 0)) {
              fail(`${id}: section[${i}].blocks[${j}] list block missing non-empty items`); structErrors++;
            } else if (b.type === 'callout' && !VALID_CALLOUT_STYLES.includes(b.style)) {
              fail(`${id}: section[${i}].blocks[${j}] callout has invalid style "${b.style}"`); structErrors++;
            }
          });
        }
      });
    }

    if (t.id) {
      if (allTopicIds.has(t.id)) { fail(`${id}: duplicate topic id across files`); structErrors++; }
      else allTopicIds.add(t.id);
    }
  }

  if (structErrors === 0) {
    pass(`all ${topics.length} topics pass structural checks`);
  }
}

// ── summary ───────────────────────────────────────────────────
console.log(`\n${'─'.repeat(52)}`);
console.log(`${passed} passed  |  ${failed} failed`);

if (failed > 0) process.exit(1);
