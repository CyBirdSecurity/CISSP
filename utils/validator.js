/**
 * validator.js — Data validation for YAML-loaded content
 */

const Validator = (() => {
  function validateFlashcard(card) {
    const errors = [];
    if (!card.id) errors.push('Missing id');
    if (!card.domain) errors.push('Missing domain');
    if (!card.term) errors.push('Missing term');
    if (!card.definition) errors.push('Missing definition');
    return errors;
  }

  function validateQuestion(q) {
    const errors = [];
    if (!q.id) errors.push('Missing id');
    if (!q.domain) errors.push('Missing domain');
    if (!q.question) errors.push('Missing question text');
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push('Must have exactly 4 options');
    }
    if (q.correct_answer === undefined || q.correct_answer === null) {
      errors.push('Missing correct_answer');
    } else if (q.correct_answer < 0 || q.correct_answer > 3) {
      errors.push('correct_answer must be 0–3');
    }
    if (!q.explanations || !q.explanations.correct) {
      errors.push('Missing explanations.correct');
    }
    return errors;
  }

  function validateDomains(domains) {
    const errors = [];
    const ids = new Set();
    domains.forEach((d, i) => {
      if (!d.id) errors.push(`Domain[${i}]: missing id`);
      if (!d.name) errors.push(`Domain[${i}]: missing name`);
      if (d.id) {
        if (ids.has(d.id)) errors.push(`Duplicate domain id: ${d.id}`);
        ids.add(d.id);
      }
    });
    return errors;
  }

  function validateAll(domains, flashcards, questions) {
    const domainIds = new Set(domains.map(d => d.id));
    const cardIds = new Set();
    const qIds = new Set();
    const errors = [];

    validateDomains(domains).forEach(e => errors.push(`[Domain] ${e}`));

    flashcards.forEach(card => {
      validateFlashcard(card).forEach(e => errors.push(`[Flashcard ${card.id || '?'}] ${e}`));
      if (card.domain && !domainIds.has(card.domain)) {
        errors.push(`[Flashcard ${card.id}] Unknown domain: ${card.domain}`);
      }
      if (card.id) {
        if (cardIds.has(card.id)) errors.push(`Duplicate flashcard id: ${card.id}`);
        cardIds.add(card.id);
      }
    });

    questions.forEach(q => {
      validateQuestion(q).forEach(e => errors.push(`[Question ${q.id || '?'}] ${e}`));
      if (q.domain && !domainIds.has(q.domain)) {
        errors.push(`[Question ${q.id}] Unknown domain: ${q.domain}`);
      }
      if (q.id) {
        if (qIds.has(q.id)) errors.push(`Duplicate question id: ${q.id}`);
        qIds.add(q.id);
      }
    });

    if (errors.length > 0) {
      console.warn(`[Validator] ${errors.length} validation error(s):`, errors);
    } else {
      console.info(`[Validator] All ${flashcards.length} flashcards and ${questions.length} questions are valid.`);
    }

    return errors;
  }

  return { validateFlashcard, validateQuestion, validateDomains, validateAll };
})();
