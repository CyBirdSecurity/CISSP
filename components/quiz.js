/**
 * quiz.js — Quiz component: setup → active → results → review
 */

const QuizComponent = (() => {
  let _container = null;
  let _allQuestions = [];
  let _domains = [];
  let _phase = 'setup'; // 'setup' | 'active' | 'results' | 'review'

  // Setup state
  let _selectedDomains = [];
  let _questionCount = 10;
  let _focusWeak = false;

  // Active quiz state
  let _questions = [];
  let _currentIndex = 0;
  let _answers = {};
  let _answered = false; // has the current question been answered?

  // Review state
  let _reviewItems = []; // incorrect results for review mode

  function init(container, questions, domains) {
    _container = container;
    _allQuestions = questions;
    _domains = domains;
    _phase = 'setup';
    _selectedDomains = [];
    _answers = {};
    render();
  }

  function render() {
    if (!_container) return;
    switch (_phase) {
      case 'setup':   _renderSetup(); break;
      case 'active':  _renderActive(); break;
      case 'results': _renderResults(); break;
      case 'review':  _renderReview(); break;
    }
  }

  // ── Setup Phase ──────────────────────────────────────────────
  function _renderSetup() {
    const weakDomains = QuizEngine.getWeakDomains(_domains);
    const domainStats = Progress.getDomainStats();

    _container.innerHTML = `
      <div class="quiz-setup">
        <div class="quiz-setup-header">
          <h2 class="setup-title">Configure Quiz</h2>
          <p class="setup-subtitle">Select domains and question count to begin</p>
        </div>

        <div class="setup-section">
          <label class="setup-label">Domains</label>
          <div class="domain-grid" id="domain-grid">
            ${_domains.map(d => {
              const stats = domainStats[d.id];
              const accuracy = stats && stats.total_questions_answered > 0
                ? Math.round((stats.total_correct / stats.total_questions_answered) * 100)
                : null;
              const isWeak = weakDomains.some(w => w.id === d.id);
              return `
                <label class="domain-chip ${_selectedDomains.includes(d.id) ? 'is-selected' : ''}
                             ${isWeak ? 'is-weak' : ''}" data-id="${d.id}">
                  <input type="checkbox" value="${d.id}"
                    ${_selectedDomains.includes(d.id) ? 'checked' : ''} hidden>
                  <span class="domain-chip-name">${d.name}</span>
                  ${accuracy !== null
                    ? `<span class="domain-chip-acc ${accuracy < 70 ? 'acc--weak' : ''}">${accuracy}%</span>`
                    : ''}
                  ${isWeak ? '<span class="weak-badge">⚡ Weak</span>' : ''}
                </label>
              `;
            }).join('')}
          </div>
          <p class="setup-hint">Select none to include all domains</p>
        </div>

        ${weakDomains.length > 0 ? `
          <div class="focus-mode-card">
            <div class="focus-mode-info">
              <div class="focus-mode-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Focus Mode — Weak Domains
              </div>
              <div class="focus-mode-desc">
                You have ${weakDomains.length} weak domain${weakDomains.length > 1 ? 's' : ''} (below 70%).
                Focus mode quizzes only those domains.
              </div>
            </div>
            <button class="btn btn-primary btn-sm" id="focus-mode-btn">
              Use Focus Mode
            </button>
          </div>
        ` : ''}

        <div class="setup-section">
          <label class="setup-label" for="q-count">Number of Questions</label>
          <div class="count-options">
            ${[5, 10, 15, 20, 30].map(n => `
              <button class="count-btn ${_questionCount === n ? 'is-selected' : ''}" data-count="${n}">${n}</button>
            `).join('')}
          </div>
        </div>

        <div class="setup-actions">
          <button class="btn btn-primary btn-lg" id="start-quiz-btn">
            Start Quiz
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    _bindSetupEvents();
  }

  function _bindSetupEvents() {
    document.querySelectorAll('.domain-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault(); // prevent label from toggling checkbox twice
        const id = chip.dataset.id;
        const idx = _selectedDomains.indexOf(id);
        if (idx >= 0) {
          _selectedDomains.splice(idx, 1);
          chip.classList.remove('is-selected');
          chip.querySelector('input').checked = false;
        } else {
          _selectedDomains.push(id);
          chip.classList.add('is-selected');
          chip.querySelector('input').checked = true;
        }
      });
    });

    document.querySelectorAll('.count-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _questionCount = parseInt(btn.dataset.count);
        document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
      });
    });

    const focusBtn = document.getElementById('focus-mode-btn');
    if (focusBtn) focusBtn.addEventListener('click', () => {
      const weakDomains = QuizEngine.getWeakDomains(_domains);
      _selectedDomains = weakDomains.map(d => d.id);
      _phase = 'active';
      _startQuiz();
    });

    const startBtn = document.getElementById('start-quiz-btn');
    if (startBtn) startBtn.addEventListener('click', () => {
      _phase = 'active';
      _startQuiz();
    });
  }

  function _startQuiz() {
    _questions = QuizEngine.selectQuestions(_allQuestions, _selectedDomains, _questionCount);
    _currentIndex = 0;
    _answers = {};
    _answered = false;

    if (_questions.length === 0) {
      alert('No questions available for the selected domains.');
      _phase = 'setup';
      render();
      return;
    }

    Progress.updateSession();
    render();
  }

  // ── Active Phase ─────────────────────────────────────────────
  function _renderActive() {
    if (_questions.length === 0) { _phase = 'setup'; render(); return; }
    const q = _questions[_currentIndex];
    const answered = _answers.hasOwnProperty(q.id);
    const selectedIdx = _answers[q.id];
    const progress = Math.round(((_currentIndex) / _questions.length) * 100);

    _container.innerHTML = `
      <div class="quiz-active">
        <div class="quiz-progress-bar">
          <div class="quiz-progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="quiz-meta">
          <span class="quiz-counter">${_currentIndex + 1} of ${_questions.length}</span>
          <button class="btn btn-ghost btn-sm" id="quit-quiz-btn">Quit Quiz</button>
        </div>

        <div class="quiz-question-card card">
          <div class="question-domain-tag">${_getDomainName(q.domain)}</div>
          <h3 class="question-text">${escapeHTML(q.question)}</h3>

          <div class="options-list" id="options-list">
            ${q.options.map((opt, i) => {
              let cls = 'option-btn';
              if (answered) {
                if (i === q.correct_answer) cls += ' option-correct';
                else if (i === selectedIdx) cls += ' option-wrong';
                else cls += ' option-disabled';
              }
              return `
                <button class="${cls}" data-index="${i}" ${answered ? 'disabled' : ''}>
                  <span class="option-letter">${'ABCD'[i]}</span>
                  <span class="option-text">${escapeHTML(opt)}</span>
                  ${answered && i === q.correct_answer
                    ? '<svg class="option-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
                    : ''}
                  ${answered && i === selectedIdx && i !== q.correct_answer
                    ? '<svg class="option-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
                    : ''}
                </button>
              `;
            }).join('')}
          </div>

          ${answered ? `
            <div id="feedback-zone">
              ${Feedback.render(q, selectedIdx)}
            </div>
            <div class="quiz-next-bar">
              ${_currentIndex < _questions.length - 1
                ? '<button class="btn btn-primary" id="next-question-btn">Next Question <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>'
                : '<button class="btn btn-primary" id="finish-quiz-btn">View Results <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>'
              }
            </div>
          ` : ''}
        </div>
      </div>
    `;

    _bindActiveEvents(q);
  }

  function _bindActiveEvents(q) {
    document.querySelectorAll('.option-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedIdx = parseInt(btn.dataset.index);
        _answers[q.id] = selectedIdx;
        const isCorrect = selectedIdx === q.correct_answer;
        Progress.updateQuizProgress(q.id, q.domain, isCorrect);
        _answered = true;
        _renderActive();
      });
    });

    const nextBtn = document.getElementById('next-question-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      _currentIndex++;
      _answered = false;
      _renderActive();
    });

    const finishBtn = document.getElementById('finish-quiz-btn');
    if (finishBtn) finishBtn.addEventListener('click', () => {
      _phase = 'results';
      render();
    });

    const quitBtn = document.getElementById('quit-quiz-btn');
    if (quitBtn) quitBtn.addEventListener('click', () => {
      if (confirm('Quit quiz? Your progress will be saved.')) {
        _phase = 'setup';
        render();
      }
    });
  }

  // ── Results Phase ────────────────────────────────────────────
  function _renderResults() {
    const score = QuizEngine.calculateScore(_questions, _answers);
    const breakdown = QuizEngine.getDomainBreakdown(_questions, _answers);
    _reviewItems = score.results.filter(r => !r.isCorrect);

    const pct = score.percentage;
    const grade = pct >= 90 ? 'Excellent' : pct >= 75 ? 'Good' : pct >= 60 ? 'Passing' : 'Needs Work';
    const gradeColor = pct >= 90 ? 'var(--c-green)' : pct >= 75 ? 'var(--c-cyan)' : pct >= 60 ? 'var(--c-blue-lt)' : 'var(--c-red)';

    _container.innerHTML = `
      <div class="quiz-results">
        <div class="results-hero card">
          <div class="results-score" style="--grade-color: ${gradeColor}">
            <div class="score-circle">
              <svg class="score-svg" viewBox="0 0 120 120">
                <circle class="score-bg" cx="60" cy="60" r="52" fill="none" stroke="var(--c-border)" stroke-width="8"/>
                <circle class="score-fill" cx="60" cy="60" r="52" fill="none"
                  stroke="${gradeColor}" stroke-width="8" stroke-linecap="round"
                  stroke-dasharray="${2 * Math.PI * 52}"
                  stroke-dashoffset="${2 * Math.PI * 52 * (1 - pct / 100)}"
                  transform="rotate(-90 60 60)"/>
              </svg>
              <div class="score-text">
                <div class="score-number">${pct}%</div>
                <div class="score-grade">${grade}</div>
              </div>
            </div>
            <div class="results-stats">
              <div class="stat-item">
                <div class="stat-value correct">${score.correct}</div>
                <div class="stat-label">Correct</div>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <div class="stat-value incorrect">${score.incorrect}</div>
                <div class="stat-label">Incorrect</div>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <div class="stat-value">${score.total}</div>
                <div class="stat-label">Total</div>
              </div>
            </div>
          </div>
        </div>

        <div class="results-breakdown card">
          <h3 class="section-label">Domain Breakdown</h3>
          ${Object.entries(breakdown).map(([domainId, stats]) => {
            const pct = Math.round((stats.correct / stats.total) * 100);
            const domain = _domains.find(d => d.id === domainId);
            return `
              <div class="breakdown-row">
                <div class="breakdown-name">${domain ? domain.name : domainId}</div>
                <div class="breakdown-bar-wrap">
                  <div class="breakdown-bar" style="width: ${pct}%; background: ${pct >= 70 ? 'var(--c-green)' : 'var(--c-red)'}"></div>
                </div>
                <div class="breakdown-score">${stats.correct}/${stats.total} (${pct}%)</div>
              </div>
            `;
          }).join('')}
        </div>

        ${_reviewItems.length > 0 ? `
          <div class="results-incorrect card">
            <h3 class="section-label">Incorrect Questions (${_reviewItems.length})</h3>
            ${_reviewItems.map((r, i) => `
              <div class="review-item">
                <div class="review-q">${i + 1}. ${escapeHTML(r.question.question)}</div>
                <div class="review-answers">
                  <div class="review-your-answer">
                    <span class="label-wrong">Your answer:</span> ${escapeHTML(r.question.options[r.selected] || 'Unanswered')}
                  </div>
                  <div class="review-correct-answer">
                    <span class="label-correct">Correct:</span> ${escapeHTML(r.question.options[r.question.correct_answer])}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="results-actions">
          ${_reviewItems.length > 0 ? `
            <button class="btn btn-secondary" id="review-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
              Review Incorrect (${_reviewItems.length})
            </button>
          ` : ''}
          <button class="btn btn-ghost" id="retake-btn">Retake Quiz</button>
          <button class="btn btn-primary" id="new-quiz-btn">New Quiz</button>
        </div>
      </div>
    `;

    document.getElementById('new-quiz-btn')?.addEventListener('click', () => {
      _phase = 'setup'; render();
    });
    document.getElementById('retake-btn')?.addEventListener('click', () => {
      _currentIndex = 0; _answers = {}; _answered = false;
      _phase = 'active'; render();
    });
    document.getElementById('review-btn')?.addEventListener('click', () => {
      _phase = 'review'; render();
    });
  }

  // ── Review Phase ─────────────────────────────────────────────
  function _renderReview() {
    if (_reviewItems.length === 0) { _phase = 'results'; render(); return; }

    _container.innerHTML = `
      <div class="quiz-review">
        <div class="review-header">
          <h2 class="review-title">Review Incorrect Answers</h2>
          <button class="btn btn-ghost btn-sm" id="back-results-btn">← Back to Results</button>
        </div>

        ${_reviewItems.map((r, i) => `
          <div class="review-card card">
            <div class="review-number">Question ${i + 1}</div>
            <p class="review-question">${escapeHTML(r.question.question)}</p>

            <div class="options-list options-list--static">
              ${r.question.options.map((opt, idx) => {
                let cls = 'option-btn option-disabled';
                if (idx === r.question.correct_answer) cls += ' option-correct';
                else if (idx === r.selected) cls += ' option-wrong';
                return `
                  <div class="${cls}">
                    <span class="option-letter">${'ABCD'[idx]}</span>
                    <span class="option-text">${escapeHTML(opt)}</span>
                    ${idx === r.question.correct_answer
                      ? '<svg class="option-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
                      : ''}
                    ${idx === r.selected && idx !== r.question.correct_answer
                      ? '<svg class="option-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
                      : ''}
                  </div>
                `;
              }).join('')}
            </div>

            ${Feedback.render(r.question, r.selected)}
          </div>
        `).join('')}

        <div class="review-footer">
          <button class="btn btn-ghost" id="back-results-btn-2">← Back to Results</button>
          <button class="btn btn-primary" id="new-quiz-btn-2">New Quiz</button>
        </div>
      </div>
    `;

    document.getElementById('back-results-btn')?.addEventListener('click', () => { _phase = 'results'; render(); });
    document.getElementById('back-results-btn-2')?.addEventListener('click', () => { _phase = 'results'; render(); });
    document.getElementById('new-quiz-btn-2')?.addEventListener('click', () => { _phase = 'setup'; render(); });
  }

  function _getDomainName(domainId) {
    const d = _domains.find(d => d.id === domainId);
    return d ? d.name : domainId;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { init };
})();
