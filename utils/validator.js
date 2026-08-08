/**
 * validator.js — Data validation for YAML-loaded content
 */

const Validator = (() => {
  // Questions are tagged by the kind of thinking they demand: 'recall' tests
  // whether a term or fact is known, 'applied' presents a situation and asks
  // for a judgment. The real exam is dominated by the latter.
  const COGNITIVE_LEVELS = ['recall', 'applied'];

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
    if (q.cognitive_level && !COGNITIVE_LEVELS.includes(q.cognitive_level)) {
      errors.push(`cognitive_level must be one of: ${COGNITIVE_LEVELS.join(', ')}`);
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

  const TOPIC_BLOCK_TYPES = ['paragraph', 'list', 'callout'];
  const TOPIC_CALLOUT_STYLES = ['tip', 'warning', 'example'];

  function validateTopicBlock(block) {
    const errors = [];
    if (!TOPIC_BLOCK_TYPES.includes(block.type)) {
      errors.push(`Unknown block type: "${block.type}"`);
      return errors;
    }
    if (block.type === 'paragraph' && !block.text) errors.push('paragraph block missing text');
    if (block.type === 'callout') {
      if (!block.text) errors.push('callout block missing text');
      if (!TOPIC_CALLOUT_STYLES.includes(block.style)) errors.push(`callout block has invalid style: "${block.style}"`);
    }
    if (block.type === 'list') {
      if (!Array.isArray(block.items) || block.items.length === 0) errors.push('list block missing non-empty items');
    }
    return errors;
  }

  function validateTopic(topic) {
    const errors = [];
    if (!topic.id) errors.push('Missing id');
    if (!topic.domain) errors.push('Missing domain');
    if (!topic.number) errors.push('Missing number');
    if (!topic.title) errors.push('Missing title');
    if (!Array.isArray(topic.sections) || topic.sections.length === 0) {
      errors.push('Missing non-empty sections');
    } else {
      topic.sections.forEach((s, i) => {
        if (!s.heading) errors.push(`Section[${i}] missing heading`);
        if (!Array.isArray(s.blocks) || s.blocks.length === 0) {
          errors.push(`Section[${i}] missing non-empty blocks`);
        } else {
          s.blocks.forEach(b => validateTopicBlock(b).forEach(e => errors.push(`Section[${i}] ${e}`)));
        }
      });
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

  function validateAll(domains, flashcards, questions, interactiveQuestions = [], topics = []) {
    const domainIds = new Set(domains.map(d => d.id));
    const cardIds = new Set();
    const qIds = new Set();
    const topicIds = new Set();
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

    topics.forEach(t => {
      validateTopic(t).forEach(e => errors.push(`[Topic ${t.id || '?'}] ${e}`));
      if (t.domain && !domainIds.has(t.domain)) {
        errors.push(`[Topic ${t.id}] Unknown domain: ${t.domain}`);
      }
      if (t.id) {
        if (topicIds.has(t.id)) errors.push(`Duplicate topic id: ${t.id}`);
        topicIds.add(t.id);
      }
    });

    if (errors.length > 0) {
      console.warn(`[Validator] ${errors.length} validation error(s):`, errors);
    } else {
      console.info(
        `[Validator] All ${flashcards.length} flashcards, ${questions.length} questions,` +
        ` ${interactiveQuestions.length} interactive questions, and ${topics.length} topics are valid.`
      );
    }

    return errors;
  }

  return {
    validateFlashcard,
    validateQuestion,
    validateInteractiveQuestion,
    validateTopic,
    validateDomains,
    validateAll
  };
})();
