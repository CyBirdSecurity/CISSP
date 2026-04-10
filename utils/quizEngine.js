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
   * Select random questions from specified domains
   * @param {Array} allQuestions - All available questions
   * @param {Array} domainIds - Domain IDs to include (empty = all)
   * @param {number} count - Number of questions to select
   */
  function selectQuestions(allQuestions, domainIds, count) {
    let pool = domainIds.length > 0
      ? allQuestions.filter(q => domainIds.includes(q.domain))
      : [...allQuestions];

    pool = shuffle(pool);
    return pool.slice(0, Math.min(count, pool.length));
  }

  /**
   * Calculate quiz score from questions and answers
   * @param {Array} questions - Array of question objects
   * @param {Object} answers - Map of questionId -> selectedIndex
   */
  function calculateScore(questions, answers) {
    let correct = 0;
    const results = questions.map(q => {
      const selected = answers[q.id];
      const isCorrect = selected !== undefined && selected === q.correct_answer;
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
   * Get domains where accuracy is below the threshold
   * @param {Array} domains - All domain objects
   * @param {number} threshold - Accuracy threshold (0-100)
   */
  function getWeakDomains(domains, threshold = 70) {
    const stats = Progress.getDomainStats();
    return domains.filter(d => {
      const s = stats[d.id];
      if (!s || s.total_questions_answered < 3) return false;
      const accuracy = (s.total_correct / s.total_questions_answered) * 100;
      return accuracy < threshold;
    });
  }

  /**
   * Get per-domain breakdown of quiz results
   * @param {Array} questions
   * @param {Object} answers
   */
  function getDomainBreakdown(questions, answers) {
    const byDomain = {};
    questions.forEach(q => {
      if (!byDomain[q.domain]) {
        byDomain[q.domain] = { correct: 0, total: 0 };
      }
      byDomain[q.domain].total++;
      if (answers[q.id] === q.correct_answer) {
        byDomain[q.domain].correct++;
      }
    });
    return byDomain;
  }

  return { selectQuestions, calculateScore, getWeakDomains, getDomainBreakdown, shuffle };
})();
