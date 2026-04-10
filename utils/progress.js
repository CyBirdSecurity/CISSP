/**
 * progress.js — localStorage-based progress tracking
 */

const Progress = (() => {
  const STORAGE_KEY = 'cissp_progress';
  const SCHEMA_VERSION = 1;
  let _data = null;

  function defaultData() {
    return {
      version: SCHEMA_VERSION,
      flashcards: {},
      questions: {},
      domains: {},
      sessions: {
        last_study_date: null,
        current_streak: 0,
        total_sessions: 0
      }
    };
  }

  function getProgress() {
    if (_data) return _data;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === SCHEMA_VERSION) {
          _data = parsed;
          return _data;
        }
      }
    } catch (e) {
      console.warn('[Progress] Failed to read localStorage:', e);
    }
    _data = defaultData();
    return _data;
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
    } catch (e) {
      console.warn('[Progress] Failed to write localStorage:', e);
    }
  }

  function updateFlashcardProgress(cardId, result) {
    const p = getProgress();
    if (!p.flashcards[cardId]) {
      p.flashcards[cardId] = {
        times_seen: 0,
        times_correct: 0,
        times_incorrect: 0,
        last_seen: null
      };
    }
    const c = p.flashcards[cardId];
    c.times_seen++;
    c.last_seen = new Date().toISOString();
    if (result === 'correct') c.times_correct++;
    else if (result === 'incorrect') c.times_incorrect++;
    saveProgress();
  }

  function updateQuizProgress(questionId, domainId, isCorrect) {
    const p = getProgress();

    if (!p.questions[questionId]) {
      p.questions[questionId] = { times_answered: 0, times_correct: 0, times_incorrect: 0 };
    }
    const q = p.questions[questionId];
    q.times_answered++;
    if (isCorrect) q.times_correct++; else q.times_incorrect++;

    if (!p.domains[domainId]) {
      p.domains[domainId] = { total_questions_answered: 0, total_correct: 0 };
    }
    const d = p.domains[domainId];
    d.total_questions_answered++;
    if (isCorrect) d.total_correct++;

    saveProgress();
  }

  function getDomainStats() {
    return getProgress().domains;
  }

  function updateSession() {
    const p = getProgress();
    const todayStr = new Date().toDateString();
    const s = p.sessions;

    if (s.last_study_date !== todayStr) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (s.last_study_date === yesterday.toDateString()) {
        s.current_streak++;
      } else {
        s.current_streak = 1;
      }
      s.total_sessions++;
      s.last_study_date = todayStr;
      saveProgress();
    }
  }

  function resetProgress() {
    _data = defaultData();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[Progress] Failed to clear localStorage:', e);
    }
  }

  function exportProgress() {
    const data = getProgress();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cissp_progress_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importProgress(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object' || parsed.version !== SCHEMA_VERSION) {
        throw new Error('Invalid format or version mismatch');
      }
      if (!parsed.flashcards || !parsed.questions || !parsed.domains || !parsed.sessions) {
        throw new Error('Missing required fields');
      }
      _data = parsed;
      saveProgress();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  function getFlashcardStats(flashcards) {
    const p = getProgress();
    let mastered = 0;
    let needsReview = 0;
    let unseen = 0;

    flashcards.forEach(card => {
      const s = p.flashcards[card.id];
      if (!s || s.times_seen === 0) {
        unseen++;
      } else {
        const accuracy = s.times_correct / (s.times_correct + s.times_incorrect || 1);
        if (accuracy >= 0.8 && s.times_seen >= 3) mastered++;
        else needsReview++;
      }
    });

    return { mastered, needsReview, unseen, total: flashcards.length };
  }

  function getTotalStats() {
    const p = getProgress();
    let totalAnswered = 0;
    let totalCorrect = 0;

    Object.values(p.domains).forEach(d => {
      totalAnswered += d.total_questions_answered;
      totalCorrect += d.total_correct;
    });

    return {
      totalAnswered,
      totalCorrect,
      accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0
    };
  }

  return {
    getProgress,
    saveProgress,
    updateFlashcardProgress,
    updateQuizProgress,
    getDomainStats,
    updateSession,
    resetProgress,
    exportProgress,
    importProgress,
    getFlashcardStats,
    getTotalStats
  };
})();
