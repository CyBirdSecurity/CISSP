/**
 * app.js — Main entry point for the CyBird Security study tool
 * Handles app initialization, routing, and page rendering
 */

// ── Apply cert config to static DOM elements ──────────────────
function applyConfig() {
  const cfg = (typeof CERT_CONFIG !== 'undefined') ? CERT_CONFIG : {};
  const name = cfg.name || 'Study Tool';

  document.title = `${name} Study Tool — CyBird Security`;

  const metaDesc = document.getElementById('meta-description');
  if (metaDesc) metaDesc.setAttribute('content',
    `Interactive ${name} exam study tool with flashcards, quizzes, and progress tracking.`);

  const navName = document.getElementById('nav-cert-name');
  if (navName) navName.textContent = `${name} Study Tool`;

  const eyebrow = document.getElementById('hero-eyebrow');
  if (eyebrow) eyebrow.textContent = cfg.eyebrow || `${name} Exam Preparation`;

  const heroTitle = document.getElementById('hero-title');
  if (heroTitle) heroTitle.innerHTML =
    `Master the <span class="gradient-text">${name}</span><br>All Domains`;

  const heroSub = document.getElementById('hero-sub');
  if (heroSub) heroSub.textContent = cfg.heroSub ||
    `Flashcards, practice quizzes, real-time feedback, and progress tracking — everything you need to pass the ${name} exam.`;

  const domainTitle = document.getElementById('domains-section-title');
  if (domainTitle) domainTitle.textContent = cfg.domainLabel || `${name} Domains`;

  const fcSubtitle = document.getElementById('flashcards-subtitle');
  if (fcSubtitle) fcSubtitle.textContent = cfg.flashcardSubtitle ||
    `Study key terms and concepts across all ${name} domains`;

  // Build the "Other Certs" dropdown if there are sibling certs configured
  const otherCerts = cfg.otherCerts || [];
  const dropdownWrap = document.getElementById('nav-other-certs');
  const dropdownMenu = document.getElementById('cert-dropdown-menu');
  if (dropdownWrap && dropdownMenu && otherCerts.length > 0) {
    dropdownMenu.innerHTML = otherCerts.map(c =>
      `<a class="nav-dropdown-item" href="${c.url}" target="_blank" rel="noopener" role="menuitem">${c.name}</a>`
    ).join('');
    dropdownWrap.style.display = '';
  }
}

// ── Global App State ─────────────────────────────────────────
const AppState = {
  domains: [],
  flashcards: [],
  questions: [],
  interactiveQuestions: [],
  topics: [],
  loaded: false
};

// ── Router ───────────────────────────────────────────────────
// Hash format: #route or #route/param (e.g. #study/d1-t1)
function getRoute() {
  const hash = window.location.hash.slice(1) || 'home';
  return hash.split('?')[0].split('/')[0]; // strip query params and any sub-route param
}

function getRouteParam() {
  const hash = window.location.hash.slice(1) || 'home';
  const parts = hash.split('?')[0].split('/');
  return parts.length > 1 ? parts[1] : null;
}

function navigate(route) {
  window.location.hash = route;
}

function router() {
  const route = getRoute();
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => p.classList.remove('active'));

  const activePage = document.getElementById(`page-${route}`);
  if (activePage) activePage.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === route);
  });

  if (AppState.loaded) {
    renderPage(route, getRouteParam());
  }
}

function renderPage(route, param) {
  switch (route) {
    case 'home':        renderHome(); break;
    case 'flashcards':  renderFlashcards(); break;
    case 'quiz':        renderQuiz(); break;
    case 'interactive': renderInteractive(); break;
    case 'exam':        renderMockExam(); break;
    case 'study':       renderStudyGuide(param); break;
    case 'progress':    renderProgress(); break;
  }
}

// ── Home Page ─────────────────────────────────────────────────
function renderHome() {
  const totalStats = Progress.getTotalStats();
  const flashcardStats = Progress.getFlashcardStats(AppState.flashcards);
  const sessionData = Progress.getProgress().sessions;

  // Update stat cards
  const els = {
    'home-total-q': AppState.questions.length,
    'home-total-fc': AppState.flashcards.length,
    'home-accuracy': totalStats.accuracy + '%',
    'home-streak': sessionData.current_streak + ' days',
    'home-total-iq': AppState.interactiveQuestions.length
  };
  Object.entries(els).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });

  // Render domain cards
  const grid = document.getElementById('home-domain-grid');
  if (!grid) return;
  const domainStats = Progress.getDomainStats();

  grid.innerHTML = AppState.domains.map(d => {
    const stats = domainStats[d.id];
    const pct = stats && stats.total_questions_answered > 0
      ? Math.round((stats.total_correct / stats.total_questions_answered) * 100)
      : 0;
    const answered = stats ? stats.total_questions_answered : 0;
    const totalQ = AppState.questions.filter(q => q.domain === d.id).length;
    return `
      <div class="domain-card" style="--domain-color: ${d.color || 'var(--c-purple)'}"
           onclick="navigate('quiz')" tabindex="0">
        <div class="domain-card-name">${d.name}</div>
        <div class="domain-card-progress">
          <div class="domain-card-bar-wrap">
            <div class="domain-card-bar" style="width: ${pct}%"></div>
          </div>
          <div class="domain-card-pct">
            ${answered > 0 ? `${pct}% accuracy · ${answered} answered` : `${totalQ} questions · Not started`}
          </div>
        </div>
        <button class="domain-card-study-link" onclick="event.stopPropagation(); navigate('study/${d.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          Study this domain
        </button>
      </div>
    `;
  }).join('');
}

// ── Flashcards Page ───────────────────────────────────────────
function renderFlashcards() {
  const container = document.getElementById('flashcard-container');
  if (container && AppState.loaded) {
    FlashcardComponent.init(container, AppState.flashcards, AppState.domains);
  }
}

// ── Quiz Page ─────────────────────────────────────────────────
function renderQuiz() {
  const container = document.getElementById('quiz-container');
  if (container && AppState.loaded) {
    // Only re-init if not already active (preserve state across nav)
    if (!container.dataset.initialized) {
      container.dataset.initialized = 'true';
      QuizComponent.init(
        container,
        AppState.questions,
        AppState.domains,
        AppState.interactiveQuestions
      );
    }
    // Check if navigated here via the interactive practice shortcut
    if (AppState.pendingInteractiveOnly) {
      AppState.pendingInteractiveOnly = false;
      QuizComponent.startInteractiveOnly();
    }
  }
}

function navigateToInteractive() {
  const qc = document.getElementById('quiz-container');
  if (qc) delete qc.dataset.initialized;
  AppState.pendingInteractiveOnly = true;
  navigate('quiz');
}

// ── Interactive Page ──────────────────────────────────────────
function renderInteractive() {
  const container = document.getElementById('interactive-container');
  if (container && AppState.loaded) {
    if (!container.dataset.initialized) {
      container.dataset.initialized = 'true';
      QuizComponent.init(
        container,
        [],
        AppState.domains,
        AppState.interactiveQuestions
      );
      QuizComponent.startInteractiveOnly();
    }
  }
}

// ── Mock Exam Page ────────────────────────────────────────────
function renderMockExam() {
  const container = document.getElementById('exam-container');
  if (container && AppState.loaded) {
    if (!container.dataset.initialized) {
      container.dataset.initialized = 'true';
      MockExamComponent.init(container, AppState.questions, AppState.domains);
    }
  }
}

// ── Study Guide Page ──────────────────────────────────────────
function renderStudyGuide(param) {
  const container = document.getElementById('study-container');
  if (container && AppState.loaded) {
    StudyGuideComponent.init(container, AppState.topics, AppState.domains, param);
  }
}

// ── Progress Page ─────────────────────────────────────────────
function renderProgress() {
  const container = document.getElementById('progress-container');
  if (!container) return;

  const totalStats = Progress.getTotalStats();
  const flashcardStats = Progress.getFlashcardStats(AppState.flashcards);
  const sessions = Progress.getProgress().sessions;
  const domainStats = Progress.getDomainStats();
  const weakDomains = QuizEngine.getWeakDomains(AppState.domains);
  const readiness = Readiness.getReadinessReport(AppState.domains, AppState.questions, AppState.flashcards, AppState.topics);
  const mockExams = Progress.getMockExamHistory();

  const readinessColor = readiness.score >= 80 ? 'var(--c-green)' : readiness.score >= 60 ? 'var(--c-amber)' : 'var(--c-red)';
  const gateLabel = { green: 'On Track', yellow: 'Needs Work', red: 'At Risk', unstarted: 'Not Started' };
  const gateColor = { green: 'var(--c-green)', yellow: 'var(--c-amber)', red: 'var(--c-red)', unstarted: 'var(--c-text-3)' };

  container.innerHTML = `
    <div class="progress-header">
      <h1 class="progress-title">Study Progress</h1>
      <p class="progress-subtitle">${(typeof CERT_CONFIG !== 'undefined' && CERT_CONFIG.progressSubtitle) ? CERT_CONFIG.progressSubtitle : 'Track your exam preparation'}</p>
    </div>

    <div class="progress-section">
      <div class="progress-section-title">Exam Readiness Score</div>
      <div class="readiness-card card">
        <div class="readiness-score-wrap">
          <div class="readiness-score-circle" style="--readiness-color:${readinessColor}">
            <svg class="score-svg" viewBox="0 0 120 120">
              <circle class="score-bg" cx="60" cy="60" r="52" fill="none" stroke="var(--c-border)" stroke-width="8"/>
              <circle class="score-fill" cx="60" cy="60" r="52" fill="none"
                stroke="${readinessColor}" stroke-width="8" stroke-linecap="round"
                stroke-dasharray="${2 * Math.PI * 52}"
                stroke-dashoffset="${2 * Math.PI * 52 * (1 - readiness.score / 100)}"
                transform="rotate(-90 60 60)"/>
            </svg>
            <div class="score-text">
              <div class="score-number">${readiness.score}</div>
              <div class="score-grade">READY</div>
            </div>
          </div>
          <div class="readiness-explain">
            <p>
              A blueprint-weighted composite of your accuracy, coverage, and recency across all 8 domains —
              weighted by ISC2's official exam weighting, not a flat average. This is what "80%" should mean:
              broad, current, and accurate across the whole exam, not just your strongest domains.
            </p>
            ${readiness.applied.penaltyReason === 'unproven' ? `
              <p class="readiness-applied readiness-applied--capped">
                Score capped at ${readiness.rawComposite > 70 ? '70' : readiness.score} until scenario competence is demonstrated.
                You've attempted <strong>${readiness.applied.attempted}</strong> of
                ${readiness.applied.totalInBank} applied questions — answer at least
                ${readiness.applied.minAttempts} to lift the cap. The real exam is mostly scenario judgment,
                so recall accuracy alone can't establish readiness.
              </p>
            ` : readiness.applied.penaltyReason === 'lagging' ? `
              <p class="readiness-applied">
                Your accuracy on applied/scenario questions is <strong>${readiness.applied.accuracyPct}%</strong>,
                below your overall performance — and scenario judgment is what the real exam mostly tests.
                Use <a href="#quiz">Scenario Drill</a> to close the gap.
              </p>
            ` : readiness.applied.attempted >= readiness.applied.minAttempts ? `
              <p class="readiness-applied readiness-applied--good">
                Applied/scenario accuracy: <strong>${readiness.applied.accuracyPct}%</strong> across
                ${readiness.applied.attempted} questions — this is the format the real exam mostly uses.
              </p>
            ` : ''}

            ${readiness.overconfidencePct !== null ? `
              <p class="readiness-calibration">
                Overconfidence signal: <strong>${readiness.overconfidencePct}%</strong> of answers you rated
                "Confident" were actually wrong. ${readiness.overconfidencePct > 20 ? 'Worth slowing down before locking in an answer.' : 'Well calibrated — trust your instincts.'}
              </p>
            ` : ''}
          </div>
        </div>
        <div class="readiness-gate-grid">
          ${readiness.domainBreakdown.map(d => `
            <div class="readiness-gate-item">
              <span class="readiness-gate-dot" style="background:${gateColor[d.gate]}"></span>
              <span class="readiness-gate-name">${d.name}</span>
              <span class="readiness-gate-label" style="color:${gateColor[d.gate]}">${gateLabel[d.gate]}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    ${mockExams.length > 0 ? `
      <div class="progress-section">
        <div class="progress-section-title">Mock Exam History</div>
        <div class="mock-history-list">
          ${mockExams.slice().reverse().slice(0, 8).map(m => `
            <div class="mock-history-row">
              <div class="mock-history-date">${new Date(m.date).toLocaleDateString()}</div>
              <div class="mock-history-bar-wrap">
                <div class="mock-history-bar" style="width:${m.percentage}%; background:${m.passed ? 'var(--c-green)' : 'var(--c-red)'}"></div>
              </div>
              <div class="mock-history-score">${m.percentage}% &middot; ${m.scaledScore}/1000</div>
              <div class="mock-history-status ${m.passed ? 'is-pass' : 'is-fail'}">${m.passed ? 'Pass' : 'Not Yet'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div class="progress-section">
      <div class="progress-section-title">Overall Performance</div>
      <div class="overall-stats">
        <div class="overall-stat-card">
          <div class="overall-stat-value">${totalStats.totalAnswered}</div>
          <div class="overall-stat-label">Questions Answered</div>
        </div>
        <div class="overall-stat-card">
          <div class="overall-stat-value">${totalStats.accuracy}%</div>
          <div class="overall-stat-label">Overall Accuracy</div>
        </div>
        <div class="overall-stat-card">
          <div class="overall-stat-value">${sessions.current_streak}</div>
          <div class="overall-stat-label">Day Streak</div>
        </div>
        <div class="overall-stat-card">
          <div class="overall-stat-value">${sessions.total_sessions}</div>
          <div class="overall-stat-label">Study Sessions</div>
        </div>
      </div>
    </div>

    <div class="progress-section">
      <div class="progress-section-title">Domain Accuracy</div>
      <div class="domain-progress-list">
        ${AppState.domains.map(d => {
          const stats = domainStats[d.id];
          const answered = stats ? stats.total_questions_answered : 0;
          const correct = stats ? stats.total_correct : 0;
          const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
          const isWeak = weakDomains.some(w => w.id === d.id);
          const barColor = answered === 0 ? 'var(--c-border)'
            : pct >= 70 ? 'var(--c-green)'
            : pct >= 50 ? 'var(--c-amber)'
            : 'var(--c-red)';
          return `
            <div class="domain-progress-item ${isWeak ? 'is-weak' : ''}">
              <div class="domain-progress-row">
                <div class="domain-progress-name">${d.name}</div>
                <div style="display:flex;align-items:center;gap:10px">
                  ${isWeak ? '<span class="weak-tag">⚡ Weak</span>' : ''}
                  <div class="domain-progress-stats">
                    ${answered > 0 ? `${correct}/${answered} correct (${pct}%)` : 'Not started'}
                  </div>
                </div>
              </div>
              <div class="domain-progress-bar-wrap">
                <div class="domain-progress-bar" style="width:${pct}%;background:${barColor}"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="progress-section">
      <div class="progress-section-title">Study Guide Progress</div>
      <div class="domain-progress-list">
        ${AppState.domains.map(d => {
          const reading = Progress.getDomainReadingProgress(d.id, AppState.topics);
          const pct = reading.total > 0 ? Math.round((reading.read / reading.total) * 100) : 0;
          return `
            <div class="domain-progress-item">
              <div class="domain-progress-row">
                <div class="domain-progress-name">${d.name}</div>
                <div class="domain-progress-stats">
                  ${reading.total > 0 ? `${reading.read}/${reading.total} topics read (${pct}%)` : 'No topics yet'}
                </div>
              </div>
              <div class="domain-progress-bar-wrap">
                <div class="domain-progress-bar" style="width:${pct}%;background:${d.color || 'var(--c-purple)'}"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="progress-section">
      <div class="progress-section-title">Flashcard Mastery</div>
      <div class="flashcard-progress-cards">
        <div class="fc-stat-card">
          <div class="fc-stat-value" style="color:var(--c-green)">${flashcardStats.mastered}</div>
          <div class="fc-stat-label">Mastered</div>
        </div>
        <div class="fc-stat-card">
          <div class="fc-stat-value" style="color:var(--c-amber)">${flashcardStats.needsReview}</div>
          <div class="fc-stat-label">Needs Review</div>
        </div>
        <div class="fc-stat-card">
          <div class="fc-stat-value" style="color:var(--c-text-3)">${flashcardStats.unseen}</div>
          <div class="fc-stat-label">Not Yet Seen</div>
        </div>
      </div>
    </div>

    <div class="progress-section">
      <div class="progress-section-title">Data Management</div>
      <div class="data-mgmt-cards">
        <div class="data-mgmt-row">
          <div class="data-mgmt-info">
            <div class="data-mgmt-title">Export Progress</div>
            <div class="data-mgmt-desc">Download your progress data as a JSON file</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="export-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
        </div>

        <div class="data-mgmt-row">
          <div class="data-mgmt-info">
            <div class="data-mgmt-title">Import Progress</div>
            <div class="data-mgmt-desc">Restore progress from a previously exported file</div>
          </div>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import
            <input type="file" accept=".json" id="import-file" style="display:none">
          </label>
        </div>

        <div class="data-mgmt-row">
          <div class="data-mgmt-info">
            <div class="data-mgmt-title">Export Reported Question Issues</div>
            <div class="data-mgmt-desc">Download questions you've flagged as possibly incorrect (${Progress.getReportedIssues().length} reported)</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="export-issues-btn" ${Progress.getReportedIssues().length === 0 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
        </div>

        <div class="data-mgmt-row danger-zone">
          <div class="data-mgmt-info">
            <div class="data-mgmt-title" style="color:var(--c-red)">Reset All Progress</div>
            <div class="data-mgmt-desc">Permanently clears all saved progress. This cannot be undone.</div>
          </div>
          <button class="btn btn-sm" id="reset-btn"
            style="background:rgba(239,68,68,0.1);color:var(--c-red);border:1px solid rgba(239,68,68,0.3)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
            Reset
          </button>
        </div>
      </div>
    </div>
  `;

  // Bind data management events
  document.getElementById('export-btn')?.addEventListener('click', () => {
    Progress.exportProgress();
    showToast('Progress exported successfully!', 'success');
  });

  document.getElementById('export-issues-btn')?.addEventListener('click', () => {
    Progress.exportReportedIssues();
    showToast('Reported issues exported!', 'success');
  });

  document.getElementById('import-file')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const result = Progress.importProgress(text);
    if (result.success) {
      showToast('Progress imported successfully!', 'success');
      renderProgress();
    } else {
      showToast(`Import failed: ${result.error}`, 'error');
    }
    e.target.value = ''; // reset input
  });

  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset ALL progress? This action cannot be undone.')) {
      Progress.resetProgress();
      // Reset quiz container state so it re-initializes
      const qc = document.getElementById('quiz-container');
      if (qc) delete qc.dataset.initialized;
      showToast('Progress has been reset.', 'success');
      renderProgress();
    }
  });
}

// ── Toast Notifications ───────────────────────────────────────
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  applyConfig();

  // Show loading overlay
  const overlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');

  try {
    if (loadingText) loadingText.textContent = 'Loading domains…';
    AppState.domains = await Loader.loadDomains();

    if (loadingText) loadingText.textContent = 'Loading flashcards…';
    AppState.flashcards = await Loader.loadAllFlashcards(AppState.domains);

    if (loadingText) loadingText.textContent = 'Loading questions…';
    AppState.questions = await Loader.loadAllQuestions(AppState.domains);

    if (loadingText) loadingText.textContent = 'Loading interactive questions…';
    AppState.interactiveQuestions = await Loader.loadAllInteractiveQuestions(AppState.domains);

    if (loadingText) loadingText.textContent = 'Loading study guide…';
    AppState.topics = await Loader.loadAllTopics(AppState.domains);

    // Validate data
    Validator.validateAll(AppState.domains, AppState.flashcards, AppState.questions, AppState.interactiveQuestions, AppState.topics);

    AppState.loaded = true;

    // Hide loading overlay
    if (overlay) {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 400);
    }

    // Initial render
    router();

  } catch (err) {
    console.error('[App] Initialization failed:', err);
    if (overlay) {
      overlay.innerHTML = `
        <div style="text-align:center;padding:40px;max-width:400px">
          <div style="font-size:40px;margin-bottom:16px">⚠️</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:12px">Failed to load data</div>
          <div style="font-size:14px;color:var(--c-text-2);margin-bottom:24px">
            ${err.message || 'Could not load study data. Make sure you are running this from a web server, not by opening the file directly.'}
          </div>
          <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }
}

// ── Navigation Setup ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Nav links
  document.querySelectorAll('.nav-link[data-route]').forEach(link => {
    link.addEventListener('click', () => {
      navigate(link.dataset.route);
      // Close mobile menu
      document.querySelector('.nav-links')?.classList.remove('open');
    });
  });

  // Other Certs dropdown toggle
  const dropdownBtn = document.getElementById('cert-dropdown-btn');
  const dropdownMenu = document.getElementById('cert-dropdown-menu');
  if (dropdownBtn && dropdownMenu) {
    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdownMenu.classList.toggle('open');
      dropdownBtn.setAttribute('aria-expanded', isOpen);
    });
    document.addEventListener('click', () => {
      dropdownMenu.classList.remove('open');
      dropdownBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // Mobile nav toggle
  const toggle = document.getElementById('nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      document.querySelector('.nav-links')?.classList.toggle('open');
    });
  }

  // Hash-based routing
  window.addEventListener('hashchange', () => {
    const currentRoute = getRoute();
    if (currentRoute !== 'quiz') {
      const qc = document.getElementById('quiz-container');
      if (qc) delete qc.dataset.initialized;
    }
    if (currentRoute !== 'interactive') {
      const ic = document.getElementById('interactive-container');
      if (ic) delete ic.dataset.initialized;
    }
    if (currentRoute !== 'exam') {
      const ec = document.getElementById('exam-container');
      if (ec) delete ec.dataset.initialized;
    }
    router();
  });

  // Start loading
  init();
});
