/**
 * quizEngine.js — Quiz logic and question selection
 */

const QuizEngine = (() => {
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Select random questions from specified domains.
   * Works for both standard and interactive questions since both have a `domain` field.
   */
  function selectQuestions(allQuestions, domainIds, count) {
    let pool = domainIds.length > 0
      ? allQuestions.filter(q => domainIds.includes(q.domain))
      : [...allQuestions];

    pool = shuffle(pool);
    return pool.slice(0, Math.min(count, pool.length));
  }

  /**
   * Type-aware answer correctness check.
   * Handles: multiple_choice (default), fillblank, multiselect, ordering, matching.
   */
  function isCorrectAnswer(q, answer) {
    if (answer === undefined || answer === null) return false;

    switch (q.type) {
      case 'multiselect': {
        if (!Array.isArray(answer) || !Array.isArray(q.correct_answers)) return false;
        if (answer.length !== q.correct_answers.length) return false;
        const a = [...answer].sort((x, y) => x - y);
        const b = [...q.correct_answers].sort((x, y) => x - y);
        return a.every((v, i) => v === b[i]);
      }

      case 'ordering': {
        if (!Array.isArray(answer) || !Array.isArray(q.correct_order)) return false;
        if (answer.length !== q.correct_order.length) return false;
        return answer.every((v, i) => v === q.correct_order[i]);
      }

      case 'matching': {
        if (!answer || typeof answer !== 'object' || !q.correct_mapping) return false;
        return q.items.every((_, idx) => {
          return String(answer[idx]) === String(q.correct_mapping[idx]);
        });
      }

      // 'fillblank' and 'multiple_choice' (or undefined type) both use single index
      default:
        return answer === q.correct_answer;
    }
  }

  /**
   * Calculate quiz score from questions and answers (type-aware).
   */
  function calculateScore(questions, answers) {
    let correct = 0;
    const results = questions.map(q => {
      const selected = answers[q.id];
      const isCorrect = isCorrectAnswer(q, selected);
      if (isCorrect) correct++;
      return { question: q, selected, isCorrect };
    });

    return {
      total: questions.length,
      correct,
      incorrect: questions.length - correct,
      percentage: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0,
      results
    };
  }

  /**
   * Get domains where accuracy is below the threshold.
   */
  function getWeakDomains(domains, threshold = 70) {
    const stats = Progress.getDomainStats();
    return domains.filter(d => {
      const s = stats[d.id];
      if (!s || s.total_questions_answered < 1) return false;
      const accuracy = (s.total_correct / s.total_questions_answered) * 100;
      return accuracy < threshold;
    });
  }

  /**
   * Return a shuffled copy of a question with its options/choices reordered
   * and correct-answer index(es) remapped to match — so an attentive user
   * can't memorize "the answer is always C" instead of the underlying
   * concept. Ordering/matching questions are returned unchanged since they
   * already randomize their own starting state.
   */
  function _permute(arr, perm) {
    return perm.map(origIdx => arr[origIdx]);
  }

  function shuffleOptions(q) {
    const type = q.type;

    if (type === 'ordering' || type === 'matching') {
      return { ...q };
    }

    if (type === 'multiselect') {
      if (!Array.isArray(q.options)) return { ...q };
      const perm = shuffle(q.options.map((_, i) => i));
      const newCorrect = (q.correct_answers || [])
        .map(orig => perm.indexOf(orig))
        .sort((a, b) => a - b);
      return { ...q, options: _permute(q.options, perm), correct_answers: newCorrect };
    }

    if (type === 'fillblank') {
      if (!Array.isArray(q.choices)) return { ...q };
      const perm = shuffle(q.choices.map((_, i) => i));
      return { ...q, choices: _permute(q.choices, perm), correct_answer: perm.indexOf(q.correct_answer) };
    }

    // Plain multiple choice (no `type` field)
    if (!Array.isArray(q.options)) return { ...q };
    const perm = shuffle(q.options.map((_, i) => i));
    const clone = {
      ...q,
      options: _permute(q.options, perm),
      correct_answer: perm.indexOf(q.correct_answer)
    };
    if (q.explanations && Array.isArray(q.explanations.incorrect)) {
      clone.explanations = { ...q.explanations, incorrect: _permute(q.explanations.incorrect, perm) };
    }
    return clone;
  }

  /**
   * Select questions composed proportionally to each domain's ISC2 exam
   * blueprint weight, rather than a flat random pull — so a mock exam's
   * domain mix matches the real exam's mix. Falls back to filling from
   * any unused question if a domain's pool can't cover its target count.
   */
  function selectWeightedQuestions(allQuestions, domains, totalCount) {
    const totalWeight = domains.reduce((sum, d) => sum + (d.weight || 0), 0) || 1;

    const targets = domains.map(d => {
      const raw = (d.weight / totalWeight) * totalCount;
      return { domain: d, raw, base: Math.floor(raw) };
    });

    let allocated = targets.reduce((sum, t) => sum + t.base, 0);
    let leftover = totalCount - allocated;
    targets.sort((a, b) => (b.raw - b.base) - (a.raw - a.base));
    for (let i = 0; i < leftover && targets.length > 0; i++) {
      targets[i % targets.length].base++;
    }

    const selected = [];
    const usedIds = new Set();
    targets.forEach(t => {
      const pool = shuffle(allQuestions.filter(q => q.domain === t.domain.id));
      const take = pool.slice(0, t.base);
      selected.push(...take);
      take.forEach(q => usedIds.add(q.id));
    });

    if (selected.length < totalCount) {
      const backfillPool = shuffle(allQuestions.filter(q => !usedIds.has(q.id)));
      selected.push(...backfillPool.slice(0, totalCount - selected.length));
    }

    return shuffle(selected).map(shuffleOptions);
  }

  /**
   * Applied/scenario questions only — the judgment-under-a-situation format
   * that dominates the real exam. Drilling these specifically is what closes
   * the gap between recognizing a definition and choosing the BEST action.
   */
  function selectScenarioQuestions(allQuestions, domainIds, count) {
    const scenarioOnly = allQuestions.filter(q => q.cognitive_level === 'applied');
    return selectQuestions(scenarioOnly, domainIds, count).map(shuffleOptions);
  }

  /**
   * Lightweight spaced-resurfacing queue: prioritizes previously-missed
   * questions and questions not seen recently, using the per-question
   * accuracy/last_seen stats already tracked in Progress. Not a full
   * SM-2 scheduler — a simple heuristic consistent with the rest of the app.
   */
  function getReviewQueue(allQuestions, limit = 20) {
    const qStats = Progress.getQuestionStats();
    const now = Date.now();

    return allQuestions
      .filter(q => qStats[q.id] && qStats[q.id].times_answered > 0)
      .map(q => {
        const s = qStats[q.id];
        const accuracy = s.times_correct / s.times_answered;
        const ageDays = s.last_seen ? (now - new Date(s.last_seen).getTime()) / 86400000 : 999;
        const priority = (1 - accuracy) * 100 + Math.min(ageDays, 30);
        return { q, priority };
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit)
      .map(x => x.q);
  }

  /**
   * Get per-domain breakdown of quiz results (type-aware).
   */
  function getDomainBreakdown(questions, answers) {
    const byDomain = {};
    questions.forEach(q => {
      if (!byDomain[q.domain]) {
        byDomain[q.domain] = { correct: 0, total: 0 };
      }
      byDomain[q.domain].total++;
      if (isCorrectAnswer(q, answers[q.id])) {
        byDomain[q.domain].correct++;
      }
    });
    return byDomain;
  }

  return {
    selectQuestions, calculateScore, isCorrectAnswer, getWeakDomains, getDomainBreakdown, shuffle,
    shuffleOptions, selectWeightedQuestions, getReviewQueue, selectScenarioQuestions
  };
})();
