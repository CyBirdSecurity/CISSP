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

// ── summary ───────────────────────────────────────────────────
console.log(`\n${'─'.repeat(52)}`);
console.log(`${passed} passed  |  ${failed} failed`);

if (failed > 0) process.exit(1);
