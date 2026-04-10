/**
 * flashcard.js — Flashcard study component
 */

const FlashcardComponent = (() => {
  let _container = null;
  let _allCards = [];
  let _filteredCards = [];
  let _domains = [];
  let _currentIndex = 0;
  let _isFlipped = false;
  let _isShuffled = false;
  let _selectedDomain = 'all';

  function init(container, cards, domains) {
    _container = container;
    _allCards = cards;
    _domains = domains;
    _selectedDomain = 'all';
    _isShuffled = false;
    _currentIndex = 0;
    _isFlipped = false;
    _applyFilter();
    render();
    Progress.updateSession();
  }

  function _applyFilter() {
    let cards = _selectedDomain === 'all'
      ? [..._allCards]
      : _allCards.filter(c => c.domain === _selectedDomain);

    if (_isShuffled) cards = QuizEngine.shuffle(cards);
    _filteredCards = cards;

    if (_currentIndex >= _filteredCards.length) _currentIndex = 0;
  }

  function render() {
    if (!_container) return;
    if (_filteredCards.length === 0) {
      _container.innerHTML = `<div class="empty-state">No flashcards available for this selection.</div>`;
      return;
    }

    const card = _filteredCards[_currentIndex];
    const domainObj = _domains.find(d => d.id === card.domain);
    const domainName = domainObj ? domainObj.name : card.domain;
    const progress = Progress.getProgress();
    const cardStats = progress.flashcards[card.id] || { times_seen: 0, times_correct: 0, times_incorrect: 0 };
    const totalInteractions = cardStats.times_correct + cardStats.times_incorrect;
    const accuracy = totalInteractions > 0
      ? Math.round((cardStats.times_correct / totalInteractions) * 100)
      : null;

    _container.innerHTML = `
      <div class="flashcard-controls">
        <div class="flashcard-filters">
          <select class="form-select" id="fc-domain-filter">
            <option value="all" ${_selectedDomain === 'all' ? 'selected' : ''}>All Domains</option>
            ${_domains.map(d => `<option value="${d.id}" ${_selectedDomain === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
          </select>
          <button class="btn btn-ghost btn-sm ${_isShuffled ? 'btn-active' : ''}" id="fc-shuffle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
            </svg>
            ${_isShuffled ? 'Shuffled' : 'Shuffle'}
          </button>
        </div>
        <div class="flashcard-counter">
          <span class="counter-current">${_currentIndex + 1}</span>
          <span class="counter-sep">/</span>
          <span class="counter-total">${_filteredCards.length}</span>
        </div>
      </div>

      <div class="flashcard-wrap" id="fc-wrap" aria-label="Click to flip">
        <div class="flashcard ${_isFlipped ? 'is-flipped' : ''}" id="fc-card">
          <div class="flashcard-face flashcard-front">
            <div class="flashcard-domain-tag">${domainName}</div>
            <div class="flashcard-term">${escapeHTML(card.term)}</div>
            <div class="flashcard-hint">Click to reveal definition</div>
          </div>
          <div class="flashcard-face flashcard-back">
            <div class="flashcard-domain-tag">${domainName}</div>
            <div class="flashcard-definition">${escapeHTML(card.definition)}</div>
            ${card.explanation ? `<div class="flashcard-explanation">${escapeHTML(card.explanation)}</div>` : ''}
            ${card.tags && card.tags.length ? `
              <div class="flashcard-tags">
                ${card.tags.map(t => `<span class="tag">${escapeHTML(t)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${_isFlipped ? `
        <div class="flashcard-actions">
          <button class="btn btn-incorrect" id="fc-incorrect">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Review Again
          </button>
          <button class="btn btn-correct" id="fc-correct">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            I Know This
          </button>
        </div>
      ` : ''}

      <div class="flashcard-nav">
        <button class="btn btn-ghost" id="fc-prev" ${_currentIndex === 0 ? 'disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Previous
        </button>

        ${cardStats.times_seen > 0 ? `
          <div class="flashcard-stat-pill">
            ${accuracy !== null ? `${accuracy}% accuracy` : ''} · Seen ${cardStats.times_seen}×
          </div>
        ` : '<div></div>'}

        <button class="btn btn-ghost" id="fc-next" ${_currentIndex === _filteredCards.length - 1 ? 'disabled' : ''}>
          Next
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    `;

    _bindEvents();

    // Mark card as seen
    Progress.updateFlashcardProgress(card.id, null);
  }

  function _bindEvents() {
    const wrap = document.getElementById('fc-wrap');
    if (wrap) wrap.addEventListener('click', toggleFlip);

    const domainFilter = document.getElementById('fc-domain-filter');
    if (domainFilter) domainFilter.addEventListener('change', e => {
      _selectedDomain = e.target.value;
      _currentIndex = 0;
      _isFlipped = false;
      _applyFilter();
      render();
    });

    const shuffleBtn = document.getElementById('fc-shuffle');
    if (shuffleBtn) shuffleBtn.addEventListener('click', () => {
      _isShuffled = !_isShuffled;
      _currentIndex = 0;
      _isFlipped = false;
      _applyFilter();
      render();
    });

    const prevBtn = document.getElementById('fc-prev');
    if (prevBtn) prevBtn.addEventListener('click', prev);

    const nextBtn = document.getElementById('fc-next');
    if (nextBtn) nextBtn.addEventListener('click', next);

    const correctBtn = document.getElementById('fc-correct');
    if (correctBtn) correctBtn.addEventListener('click', e => {
      e.stopPropagation();
      const card = _filteredCards[_currentIndex];
      Progress.updateFlashcardProgress(card.id, 'correct');
      next();
    });

    const incorrectBtn = document.getElementById('fc-incorrect');
    if (incorrectBtn) incorrectBtn.addEventListener('click', e => {
      e.stopPropagation();
      const card = _filteredCards[_currentIndex];
      Progress.updateFlashcardProgress(card.id, 'incorrect');
      next();
    });
  }

  function toggleFlip() {
    _isFlipped = !_isFlipped;
    const cardEl = document.getElementById('fc-card');
    if (cardEl) {
      cardEl.classList.toggle('is-flipped', _isFlipped);
    }
    // Re-render to show/hide action buttons
    render();
  }

  function next() {
    if (_currentIndex < _filteredCards.length - 1) {
      _currentIndex++;
      _isFlipped = false;
      render();
    }
  }

  function prev() {
    if (_currentIndex > 0) {
      _currentIndex--;
      _isFlipped = false;
      render();
    }
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
