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

  return { selectQuestions, calculateScore, isCorrectAnswer, getWeakDomains, getDomainBreakdown, shuffle };
})();
