/**
 * mockExam.js — Full-length, timed, blueprint-weighted mock exam
 *
 * Deliberately restricted to standard multiple-choice questions (the
 * overwhelming majority of the question bank): unlike Practice Quiz, this
 * mode gives no mid-question feedback and allows free navigation/flagging
 * across the whole set, closer to the real Pearson VUE testlet experience,
 * which the ordering/matching/multiselect/fillblank submit-and-reveal
 * components aren't built for.
 */
const MockExamComponent = (() => {
  let _container = null;
  let _domains = [];
  let _allQuestions = [];
  let _phase = 'setup'; // 'setup' | 'active' | 'results'

  const LENGTH_OPTIONS = [
    { count: 75,  minutes: 100 },
    { count: 100, minutes: 133 },
    { count: 150, minutes: 200 }
  ];
  const SECONDS_PER_QUESTION = 80;

  let _examLength = 100;
  let _questions = [];
  let _currentIndex = 0;
  let _answers = {};
  let _flagged = new Set();
  let _endTime = null;
  let _timerInterval = null;
  let _lastResult = null;

  function init(container, questions, domains) {
    _container = container;
    _allQuestions = questions;
    _domains = domains;
    _phase = 'setup';
    render();
  }

  function render() {
    if (!_container) return;
    switch (_phase) {
      case 'setup':   _renderSetup(); break;
      case 'active':  _renderActive(); break;
      case 'results': _renderResults(); break;
    }
  }

  // ── Setup Phase ──────────────────────────────────────────────
  function _renderSetup() {
    _container.innerHTML = `
      <div class="mock-exam-setup">
        <div class="quiz-setup-header">
          <h2 class="setup-title">Full-Length Mock Exam</h2>
          <p class="setup-subtitle">Timed, blueprint-weighted, no mid-question feedback</p>
        </div>

        <div class="mock-exam-info card">
          <ul class="mock-exam-info-list">
            <li>Questions are drawn across all 8 domains proportional to ISC2's official exam weighting — not a flat random pull.</li>
            <li>You won't see whether an answer is right or wrong until you submit the full exam, just like the real thing.</li>
            <li>Flag questions to revisit and jump between questions freely using the navigator below the exam.</li>
            <li>The clock keeps running in the background — the exam auto-submits when time expires.</li>
          </ul>
        </div>

        <div class="setup-section">
          <label class="setup-label">Exam Length</label>
          <div class="mock-exam-length-options">
            ${LENGTH_OPTIONS.map(opt => `
              <button class="mock-length-btn ${_examLength === opt.count ? 'is-selected' : ''}" data-count="${opt.count}">
                <div class="mock-length-count">${opt.count}</div>
                <div class="mock-length-sub">questions</div>
                <div class="mock-length-time">~${opt.minutes} min</div>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="setup-actions">
          <button class="btn btn-primary btn-lg" id="start-exam-btn">
            Begin Mock Exam
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        </div>
      </div>
    `;

    document.querySelectorAll('.mock-length-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _examLength = parseInt(btn.dataset.count);
        document.querySelectorAll('.mock-length-btn').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
      });
    });

    document.getElementById('start-exam-btn')?.addEventListener('click', _startExam);
  }

  function _startExam() {
    _questions = QuizEngine.selectWeightedQuestions(_allQuestions, _domains, _examLength);
    if (_questions.length === 0) {
      alert('No questions available to build a mock exam.');
      return;
    }
    _currentIndex = 0;
    _answers = {};
    _flagged = new Set();
    _endTime = Date.now() + _questions.length * SECONDS_PER_QUESTION * 1000;

    Progress.updateSession();
    _phase = 'active';
    render();
    _startTimer();
  }

  function _startTimer() {
    _stopTimer();
    _timerInterval = setInterval(() => {
      const remaining = _endTime - Date.now();
      const el = document.getElementById('exam-timer');
      if (remaining <= 0) {
        _stopTimer();
        _submitExam();
        return;
      }
      if (el) {
        el.textContent = _formatTime(remaining);
        el.classList.toggle('is-urgent', remaining < 5 * 60 * 1000);
      }
    }, 1000);
  }

  function _stopTimer() {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  }

  function _formatTime(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  // ── Active Phase ─────────────────────────────────────────────
  function _renderActive() {
    const q = _questions[_currentIndex];
    const selected = _answers[q.id];
    const answeredCount = Object.keys(_answers).length;
    const remaining = _endTime - Date.now();

    _container.innerHTML = `
      <div class="mock-exam-active">
        <div class="mock-exam-topbar">
          <div class="mock-exam-timer ${remaining < 5 * 60 * 1000 ? 'is-urgent' : ''}" id="exam-timer">${_formatTime(remaining)}</div>
          <div class="mock-exam-counter">${_currentIndex + 1} of ${_questions.length} &middot; ${answeredCount} answered</div>
          <button class="btn btn-ghost btn-sm" id="exit-exam-btn">Exit Exam</button>
        </div>

        <div class="quiz-question-card card">
          <div class="question-header-row">
            <div class="question-domain-tag">${_getDomainName(q.domain)}</div>
            <button class="flag-btn ${_flagged.has(q.id) ? 'is-flagged' : ''}" id="flag-btn" aria-label="Flag for review">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${_flagged.has(q.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
              ${_flagged.has(q.id) ? 'Flagged' : 'Flag for Review'}
            </button>
          </div>
          <h3 class="question-text">${_esc(q.question)}</h3>
          <div class="options-list" id="exam-options-list">
            ${q.options.map((opt, i) => `
              <button class="option-btn ${selected === i ? 'option-selected-plain' : ''}" data-index="${i}">
                <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                <span class="option-text">${_esc(opt)}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="mock-exam-navrow">
          <button class="btn btn-secondary" id="prev-q-btn" ${_currentIndex === 0 ? 'disabled' : ''}>&larr; Previous</button>
          ${_currentIndex < _questions.length - 1
            ? '<button class="btn btn-primary" id="next-q-btn">Next &rarr;</button>'
            : '<button class="btn btn-primary" id="submit-exam-btn">Submit Exam</button>'
          }
        </div>

        <div class="mock-exam-navigator">
          ${_questions.map((qq, i) => {
            let cls = 'nav-dot';
            if (i === _currentIndex) cls += ' is-current';
            if (_answers.hasOwnProperty(qq.id)) cls += ' is-answered';
            if (_flagged.has(qq.id)) cls += ' is-flagged';
            return `<button class="${cls}" data-goto="${i}" title="Question ${i + 1}">${i + 1}</button>`;
          }).join('')}
        </div>
      </div>
    `;

    _bindActiveEvents(q);
  }

  function _bindActiveEvents(q) {
    document.querySelectorAll('#exam-options-list .option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _answers[q.id] = parseInt(btn.dataset.index);
        _renderActive();
      });
    });

    document.getElementById('flag-btn')?.addEventListener('click', () => {
      if (_flagged.has(q.id)) _flagged.delete(q.id); else _flagged.add(q.id);
      _renderActive();
    });

    document.getElementById('prev-q-btn')?.addEventListener('click', () => {
      _currentIndex = Math.max(0, _currentIndex - 1);
      _renderActive();
    });

    document.getElementById('next-q-btn')?.addEventListener('click', () => {
      _currentIndex = Math.min(_questions.length - 1, _currentIndex + 1);
      _renderActive();
    });

    document.getElementById('submit-exam-btn')?.addEventListener('click', () => {
      const unanswered = _questions.length - Object.keys(_answers).length;
      const msg = unanswered > 0
        ? `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`
        : 'Submit your mock exam?';
      if (confirm(msg)) _submitExam();
    });

    document.querySelectorAll('.nav-dot').forEach(btn => {
      btn.addEventListener('click', () => {
        _currentIndex = parseInt(btn.dataset.goto);
        _renderActive();
      });
    });

    document.getElementById('exit-exam-btn')?.addEventListener('click', () => {
      if (confirm('Exit mock exam? Your progress on this attempt will be lost.')) {
        _stopTimer();
        _phase = 'setup';
        render();
      }
    });
  }

  function _submitExam() {
    _stopTimer();
    const score = QuizEngine.calculateScore(_questions, _answers);
    const breakdown = QuizEngine.getDomainBreakdown(_questions, _answers);

    // Also feed results into the same per-question/per-domain progress
    // tracking Practice Quiz uses, so mock exam attempts count toward
    // the readiness score and Review Queue too.
    _questions.forEach(q => {
      const ans = _answers[q.id];
      const isCorrect = ans !== undefined && QuizEngine.isCorrectAnswer(q, ans);
      Progress.updateQuizProgress(q.id, q.domain, isCorrect);
    });

    // Rough scaled-score estimate against ISC2's published 700/1000 passing
    // standard. This is an approximation for practice purposes only — the
    // real CAT exam does not score on raw percent-correct.
    const scaledScore = Math.round((score.percentage / 100) * 1000);
    const passed = scaledScore >= 700;

    const domainDetails = _domains.map(d => {
      const b = breakdown[d.id] || { correct: 0, total: 0 };
      return {
        id: d.id, name: d.name,
        correct: b.correct, total: b.total,
        pct: b.total > 0 ? Math.round((b.correct / b.total) * 100) : null
      };
    });

    Progress.addMockExamResult({
      totalQuestions: score.total,
      correct: score.correct,
      percentage: score.percentage,
      scaledScore,
      passed,
      domainBreakdown: domainDetails.map(({ id, correct, total, pct }) => ({ id, correct, total, pct }))
    });

    _lastResult = { score, breakdown: domainDetails, scaledScore, passed };
    _phase = 'results';
    render();
  }

  // ── Results Phase ────────────────────────────────────────────
  function _renderResults() {
    const { score, breakdown, scaledScore, passed } = _lastResult;

    _container.innerHTML = `
      <div class="mock-exam-results">
        <div class="results-hero card">
          <div class="mock-pass-banner ${passed ? 'is-pass' : 'is-fail'}">
            ${passed ? 'Estimated Pass' : 'Estimated Not Yet Passing'}
          </div>
          <div class="results-score" style="--grade-color: ${passed ? 'var(--c-green)' : 'var(--c-red)'}">
            <div class="score-circle">
              <svg class="score-svg" viewBox="0 0 120 120">
                <circle class="score-bg" cx="60" cy="60" r="52" fill="none" stroke="var(--c-border)" stroke-width="8"/>
                <circle class="score-fill" cx="60" cy="60" r="52" fill="none"
                  stroke="${passed ? 'var(--c-green)' : 'var(--c-red)'}" stroke-width="8" stroke-linecap="round"
                  stroke-dasharray="${2 * Math.PI * 52}"
                  stroke-dashoffset="${2 * Math.PI * 52 * (1 - score.percentage / 100)}"
                  transform="rotate(-90 60 60)"/>
              </svg>
              <div class="score-text">
                <div class="score-number">${score.percentage}%</div>
                <div class="score-grade">${scaledScore} / 1000 (est.)</div>
              </div>
            </div>
            <div class="results-stats">
              <div class="stat-item"><div class="stat-value correct">${score.correct}</div><div class="stat-label">Correct</div></div>
              <div class="stat-divider"></div>
              <div class="stat-item"><div class="stat-value incorrect">${score.incorrect}</div><div class="stat-label">Incorrect</div></div>
              <div class="stat-divider"></div>
              <div class="stat-item"><div class="stat-value">${score.total}</div><div class="stat-label">Total</div></div>
            </div>
          </div>
          <p class="mock-exam-disclaimer">
            This is a rough estimate for practice purposes, based on your raw score against ISC2's published 700/1000 passing
            standard — not an official prediction of your real CAT exam result.
          </p>
        </div>

        <div class="results-breakdown card">
          <h3 class="section-label">Domain Breakdown</h3>
          ${breakdown.map(d => `
            <div class="breakdown-row">
              <div class="breakdown-name">${d.name}</div>
              <div class="breakdown-bar-wrap">
                <div class="breakdown-bar" style="width:${d.pct ?? 0}%; background:${(d.pct ?? 0) >= 70 ? 'var(--c-green)' : 'var(--c-red)'}"></div>
              </div>
              <div class="breakdown-score">${d.total > 0 ? `${d.correct}/${d.total} (${d.pct}%)` : 'No questions'}</div>
            </div>
          `).join('')}
        </div>

        <div class="results-actions">
          <button class="btn btn-ghost" id="new-exam-btn">New Mock Exam</button>
          <button class="btn btn-primary" id="exam-to-progress-btn">View Full Progress</button>
        </div>
      </div>
    `;

    document.getElementById('new-exam-btn')?.addEventListener('click', () => { _phase = 'setup'; render(); });
    document.getElementById('exam-to-progress-btn')?.addEventListener('click', () => navigate('progress'));
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _getDomainName(domainId) {
    const d = _domains.find(x => x.id === domainId);
    return d ? d.name : domainId;
  }

  function _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { init };
})();
