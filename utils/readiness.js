/**
 * readiness.js — Blueprint-weighted exam readiness score
 *
 * A flat average of quiz accuracy can hit 80%+ while several
 * ISC2-blueprint-weighted domains are barely touched. This module
 * computes a composite score that a domain can only score well on by
 * being both accurate AND broadly, recently practiced — so "80% ready"
 * here tracks much closer to real exam readiness than a raw average.
 */
const Readiness = (() => {
  const STALE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

  function _domainQuizReadiness(domain, allQuestions, progress) {
    const domainQuestions = allQuestions.filter(q => q.domain === domain.id);
    const totalInPool = domainQuestions.length;
    const dStats = progress.domains[domain.id];
    const answered = dStats ? dStats.total_questions_answered : 0;
    const correct = dStats ? dStats.total_correct : 0;
    const accuracy = answered > 0 ? correct / answered : 0;

    const qStats = progress.questions;
    const now = Date.now();
    let distinctSeen = 0;
    let freshCount = 0;

    domainQuestions.forEach(q => {
      const s = qStats[q.id];
      if (s && s.times_answered > 0) {
        distinctSeen++;
        if (s.last_seen && (now - new Date(s.last_seen).getTime()) <= STALE_MS) {
          freshCount++;
        }
      }
    });

    const coverage = totalInPool > 0 ? distinctSeen / totalInPool : 0;
    // Full coverage credit once half the domain's pool has been attempted at least once —
    // rewards breadth without requiring every question be seen to score well.
    const coverageFactor = 0.6 + 0.4 * Math.min(1, coverage / 0.5);
    const recencyFactor = distinctSeen > 0 ? (0.7 + 0.3 * (freshCount / distinctSeen)) : 1;

    const readiness = answered > 0
      ? Math.round(accuracy * coverageFactor * recencyFactor * 100)
      : 0;

    return {
      domainId: domain.id,
      weight: domain.weight || 0,
      accuracyPct: Math.round(accuracy * 100),
      coveragePct: Math.round(coverage * 100),
      answered,
      totalInPool,
      readiness
    };
  }

  function _gate(readiness, answered) {
    if (answered === 0) return 'unstarted';
    if (readiness >= 80) return 'green';
    if (readiness >= 60) return 'yellow';
    return 'red';
  }

  /**
   * Full breakdown: per-domain readiness + gate, plus a single composite score.
   */
  function getReadinessReport(domains, allQuestions, flashcards, topics) {
    const progress = Progress.getProgress();

    const domainBreakdown = domains.map(d => {
      const r = _domainQuizReadiness(d, allQuestions, progress);
      return { ...r, name: d.name, gate: _gate(r.readiness, r.answered) };
    });

    const totalWeight = domainBreakdown.reduce((sum, d) => sum + d.weight, 0) || 1;
    const weightedQuizScore = domainBreakdown.reduce(
      (sum, d) => sum + d.readiness * d.weight, 0
    ) / totalWeight;

    const flashcardStats = Progress.getFlashcardStats(flashcards);
    const flashcardMasteryPct = flashcardStats.total > 0
      ? (flashcardStats.mastered / flashcardStats.total) * 100
      : 0;

    let studyGuidePct = 0;
    if (topics.length > 0) {
      const readCount = topics.filter(t => progress.topics[t.id]?.read).length;
      studyGuidePct = (readCount / topics.length) * 100;
    }

    // Quiz performance is the dominant signal; flashcards/study guide are
    // supplementary evidence of engagement with the material.
    const composite = Math.round(
      weightedQuizScore * 0.85 + flashcardMasteryPct * 0.10 + studyGuidePct * 0.05
    );

    const calibration = Progress.getCalibrationStats();
    const confident = calibration.confident;
    const overconfidencePct = confident.total > 0
      ? Math.round(((confident.total - confident.correct) / confident.total) * 100)
      : null;

    return {
      score: composite,
      weightedQuizScore: Math.round(weightedQuizScore),
      flashcardMasteryPct: Math.round(flashcardMasteryPct),
      studyGuidePct: Math.round(studyGuidePct),
      overconfidencePct,
      domainBreakdown
    };
  }

  return { getReadinessReport };
})();
