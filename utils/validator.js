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

  function validateInteractiveQuestion(q) {
    const errors = [];
    if (!q.id) errors.push('Missing id');
    if (!q.domain) errors.push('Missing domain');
    if (!q.question) errors.push('Missing question text');
    if (!q.type) errors.push('Missing type');
    if (!q.explanation) errors.push('Missing explanation');

    switch (q.type) {
      case 'ordering':
        if (!Array.isArray(q.items) || q.items.length < 2) {
          errors.push('ordering: items must be an array with at least 2 elements');
        }
        if (!Array.isArray(q.correct_order)) {
          errors.push('ordering: missing correct_order array');
        } else if (q.items && q.correct_order.length !== q.items.length) {
          errors.push('ordering: correct_order length must match items length');
        }
        break;

      case 'matching':
        if (!Array.isArray(q.items) || q.items.length < 2) {
          errors.push('matching: items must be an array with at least 2 elements');
        }
        if (!Array.isArray(q.categories) || q.categories.length < 2) {
          errors.push('matching: categories must be an array with at least 2 elements');
        }
        if (!q.correct_mapping || typeof q.correct_mapping !== 'object') {
          errors.push('matching: missing correct_mapping object');
        } else if (q.items && Object.keys(q.correct_mapping).length !== q.items.length) {
          errors.push('matching: correct_mapping must have an entry for every item');
        }
        break;

      case 'multiselect':
        if (!Array.isArray(q.options) || q.options.length < 2) {
          errors.push('multiselect: options must be an array with at least 2 elements');
        }
        if (!Array.isArray(q.correct_answers) || q.correct_answers.length < 1) {
          errors.push('multiselect: correct_answers must be a non-empty array');
        }
        break;

      case 'fillblank':
        if (!q.template || !q.template.includes('{blank}')) {
          errors.push('fillblank: template must be a string containing {blank}');
        }
        if (!Array.isArray(q.choices) || q.choices.length < 2) {
          errors.push('fillblank: choices must be an array with at least 2 elements');
        }
        if (q.correct_answer === undefined || q.correct_answer === null) {
          errors.push('fillblank: missing correct_answer');
        }
        break;

      default:
        errors.push(`Unknown interactive question type: "${q.type}"`);
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

  function validateAll(domains, flashcards, questions, interactiveQuestions = []) {
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

    interactiveQuestions.forEach(q => {
      validateInteractiveQuestion(q).forEach(e => errors.push(`[Interactive ${q.id || '?'}] ${e}`));
      if (q.domain && !domainIds.has(q.domain)) {
        errors.push(`[Interactive ${q.id}] Unknown domain: ${q.domain}`);
      }
      if (q.id) {
        if (qIds.has(q.id)) errors.push(`Duplicate interactive question id: ${q.id}`);
        qIds.add(q.id);
      }
    });

    if (errors.length > 0) {
      console.warn(`[Validator] ${errors.length} validation error(s):`, errors);
    } else {
      console.info(
        `[Validator] All ${flashcards.length} flashcards, ${questions.length} questions,` +
        ` and ${interactiveQuestions.length} interactive questions are valid.`
      );
    }

    return errors;
  }

  return { validateFlashcard, validateQuestion, validateInteractiveQuestion, validateDomains, validateAll };
})();
