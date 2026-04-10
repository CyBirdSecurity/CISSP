/**
 * app.js — Main entry point for CISSP Study Tool
 * Handles app initialization, routing, and page rendering
 */

// ── Global App State ─────────────────────────────────────────
const AppState = {
  domains: [],
  flashcards: [],
  questions: [],
  loaded: false
};

// ── Router ───────────────────────────────────────────────────
function getRoute() {
  const hash = window.location.hash.slice(1) || 'home';
  return hash.split('?')[0]; // strip query params
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
    renderPage(route);
  }
}

function renderPage(route) {
  switch (route) {
    case 'home':       renderHome(); break;
    case 'flashcards': renderFlashcards(); break;
    case 'quiz':       renderQuiz(); break;
    case 'progress':   renderProgress(); break;
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
    'home-streak': sessionData.current_streak + ' days'
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
      QuizComponent.init(container, AppState.questions, AppState.domains);
    }
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

  container.innerHTML = `
    <div class="progress-header">
      <h1 class="progress-title">Study Progress</h1>
      <p class="progress-subtitle">Track your CISSP exam preparation</p>
    </div>

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

    // Validate data
    Validator.validateAll(AppState.domains, AppState.flashcards, AppState.questions);

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

  // Mobile nav toggle
  const toggle = document.getElementById('nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      document.querySelector('.nav-links')?.classList.toggle('open');
    });
  }

  // Hash-based routing
  window.addEventListener('hashchange', () => {
    // Reset quiz state on nav away
    const currentRoute = getRoute();
    if (currentRoute !== 'quiz') {
      const qc = document.getElementById('quiz-container');
      if (qc) delete qc.dataset.initialized;
    }
    router();
  });

  // Start loading
  init();
});
