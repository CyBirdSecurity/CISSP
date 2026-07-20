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

const domainIds = new Set(domains.map(d => d.id));
domains.forEach((d, i) => {
  check(!!d.id,   `domain[${i}] has id`);
  check(!!d.name, `domain[${i}] has name`);
});

// ── question files ────────────────────────────────────────────
const allQuestionIds = new Set();

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

    // Cross-file duplicate ID check
    if (q.id) {
      if (allQuestionIds.has(q.id)) { fail(`${id}: duplicate question id across files`); structErrors++; }
      else allQuestionIds.add(q.id);
    }
  }

  if (structErrors === 0) {
    pass(`all ${questions.length} questions pass structural checks`);
  }
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
