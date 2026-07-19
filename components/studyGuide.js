/**
 * studyGuide.js — Book-style Study Guide component
 */

const StudyGuideComponent = (() => {
  let _container = null;
  let _topics = [];        // linear order: domain order, then topic order within domain
  let _domains = [];
  let _byId = {};
  let _byDomain = {};
  let _currentTopicId = null;
  let _expandedDomains = new Set();
  let _searchQuery = '';

  function init(container, topics, domains, param) {
    _container = container;
    _topics = topics;
    _domains = domains;
    _searchQuery = '';
    _byId = {};
    _byDomain = {};

    topics.forEach(t => {
      _byId[t.id] = t;
      if (!_byDomain[t.domain]) _byDomain[t.domain] = [];
      _byDomain[t.domain].push(t);
    });

    _currentTopicId = _resolveInitialTopic(param);
    _expandedDomains = new Set(_currentTopicId && _byId[_currentTopicId] ? [_byId[_currentTopicId].domain] : []);

    render();
    Progress.updateSession();
  }

  function _resolveInitialTopic(param) {
    if (param) {
      if (_byId[param]) return param;
      // Param might be a domain id (e.g. "domain2") — jump to its first topic
      const domainTopics = _byDomain[param];
      if (domainTopics && domainTopics.length) return domainTopics[0].id;
    }
    return _topics.length ? _topics[0].id : null;
  }

  function _domainName(domainId) {
    const d = _domains.find(x => x.id === domainId);
    return d ? d.name : domainId;
  }

  function _domainColor(domainId) {
    const d = _domains.find(x => x.id === domainId);
    return (d && d.color) || 'var(--c-purple)';
  }

  function _searchResults() {
    const q = _searchQuery.trim().toLowerCase();
    if (!q) return null;
    return _topics.filter(t => {
      const haystacks = [
        t.title, t.summary,
        ...(t.tags || []),
        ...(t.key_terms || [])
      ].filter(Boolean).map(s => s.toLowerCase());
      return haystacks.some(h => h.includes(q));
    });
  }

  function render() {
    if (!_container) return;
    _container.innerHTML = `
      <div class="study-layout">
        <aside class="study-sidebar" id="study-sidebar">
          ${_renderSidebarInner()}
        </aside>
        <div class="study-content" id="study-content">
          ${_renderContentInner()}
        </div>
      </div>
    `;
    _bindEvents();

    if (_currentTopicId) {
      Progress.markTopicRead(_currentTopicId);
    }
  }

  function _renderSidebarInner() {
    const results = _searchResults();

    const searchBox = `
      <div class="study-search-wrap">
        <svg class="study-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" class="study-search-input" id="study-search-input"
          placeholder="Search topics, tags, key terms…" value="${escapeHTML(_searchQuery)}">
        ${_searchQuery ? `<button class="study-search-clear" id="study-search-clear" aria-label="Clear search">×</button>` : ''}
      </div>
    `;

    if (results) {
      const body = results.length
        ? `<div class="study-search-results">
            ${results.map(t => _renderTopicItem(t, true)).join('')}
          </div>`
        : `<div class="study-search-empty">No topics match "${escapeHTML(_searchQuery)}"</div>`;
      return searchBox + body;
    }

    const tree = _domains.map(d => {
      const domainTopics = _byDomain[d.id] || [];
      const isOpen = _expandedDomains.has(d.id);
      const readCount = domainTopics.filter(t => Progress.getProgress().topics[t.id]?.read).length;
      return `
        <details class="study-domain-group" data-domain="${d.id}" style="--domain-color:${d.color || 'var(--c-purple)'}" ${isOpen ? 'open' : ''}>
          <summary class="study-domain-summary">
            <span class="study-domain-name">${escapeHTML(d.name)}</span>
            <span class="study-domain-count">${readCount}/${domainTopics.length}</span>
          </summary>
          <div class="study-topic-list">
            ${domainTopics.map(t => _renderTopicItem(t, false)).join('')}
          </div>
        </details>
      `;
    }).join('');

    return searchBox + `<div class="study-domain-tree">${tree}</div>`;
  }

  function _renderTopicItem(topic, showDomainBadge) {
    const isRead = !!Progress.getProgress().topics[topic.id]?.read;
    const isActive = topic.id === _currentTopicId;
    return `
      <button class="study-topic-item ${isActive ? 'is-active' : ''}" data-topic-id="${topic.id}">
        <span class="study-topic-dot ${isRead ? 'is-read' : ''}"></span>
        <span class="study-topic-label">
          ${showDomainBadge ? `<span class="study-topic-domain-badge" style="--domain-color:${_domainColor(topic.domain)}">${escapeHTML(_domainName(topic.domain))}</span>` : ''}
          <span class="study-topic-number">${escapeHTML(topic.number)}</span> ${escapeHTML(topic.title)}
        </span>
      </button>
    `;
  }

  function _renderContentInner() {
    const topic = _byId[_currentTopicId];
    if (!topic) {
      return `<div class="empty-state">Select a topic from the sidebar to begin reading.</div>`;
    }

    const idx = _topics.findIndex(t => t.id === topic.id);
    const prevTopic = idx > 0 ? _topics[idx - 1] : null;
    const nextTopic = idx < _topics.length - 1 ? _topics[idx + 1] : null;

    return `
      <div class="study-breadcrumb">
        <span style="color:${_domainColor(topic.domain)}">${escapeHTML(_domainName(topic.domain))}</span>
        <span class="study-breadcrumb-sep">/</span>
        <span>${escapeHTML(topic.number)} ${escapeHTML(topic.title)}</span>
      </div>

      <h1 class="study-topic-title">${escapeHTML(topic.title)}</h1>
      ${topic.summary ? `<p class="study-topic-summary">${escapeHTML(topic.summary)}</p>` : ''}

      <div class="study-sections">
        ${(topic.sections || []).map(s => `
          <section class="study-section">
            <h2 class="study-section-heading">${escapeHTML(s.heading)}</h2>
            ${(s.blocks || []).map(_renderBlock).join('')}
          </section>
        `).join('')}
      </div>

      ${topic.key_terms && topic.key_terms.length ? `
        <div class="study-key-terms">
          <div class="study-key-terms-title">Key Terms</div>
          <div class="study-key-terms-list">
            ${topic.key_terms.map(t => `<span class="tag">${escapeHTML(t)}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <div class="study-nav-buttons">
        <button class="btn btn-ghost study-nav-btn" id="study-prev" ${prevTopic ? '' : 'disabled'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          <span class="study-nav-label">${prevTopic ? escapeHTML(prevTopic.title) : 'Previous'}</span>
        </button>
        <button class="btn btn-ghost study-nav-btn" id="study-next" ${nextTopic ? '' : 'disabled'}>
          <span class="study-nav-label">${nextTopic ? escapeHTML(nextTopic.title) : 'Next'}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    `;
  }

  function _renderBlock(block) {
    switch (block.type) {
      case 'paragraph':
        return `<p class="study-paragraph">${escapeHTML(block.text)}</p>`;
      case 'list': {
        const tag = block.style === 'numbered' ? 'ol' : 'ul';
        return `<${tag} class="study-list">${(block.items || []).map(i => `<li>${escapeHTML(i)}</li>`).join('')}</${tag}>`;
      }
      case 'callout':
        return `
          <div class="study-callout study-callout--${block.style}">
            <span class="study-callout-label">${block.style === 'tip' ? 'Exam Tip' : block.style === 'warning' ? 'Watch Out' : 'Example'}</span>
            <p>${escapeHTML(block.text)}</p>
          </div>
        `;
      default:
        return '';
    }
  }

  function _bindEvents() {
    _bindSidebarEvents();
    _bindContentEvents();
  }

  // Rebinds everything inside #study-sidebar. Must be called after ANY
  // replacement of the sidebar's innerHTML (search input, clear, topic
  // selection) since re-rendering destroys the previous listeners.
  function _bindSidebarEvents() {
    const searchInput = document.getElementById('study-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        _searchQuery = e.target.value;
        _rerenderSidebar({ keepSearchFocus: true });
      });
    }

    const clearBtn = document.getElementById('study-search-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      _searchQuery = '';
      _rerenderSidebar({});
    });

    document.querySelectorAll('.study-topic-item').forEach(btn => {
      btn.addEventListener('click', () => _selectTopic(btn.dataset.topicId));
    });
    document.querySelectorAll('.study-domain-group').forEach(details => {
      details.addEventListener('toggle', () => {
        const domainId = details.dataset.domain;
        if (details.open) _expandedDomains.add(domainId);
        else _expandedDomains.delete(domainId);
      });
    });
  }

  function _rerenderSidebar({ keepSearchFocus }) {
    const sidebar = document.getElementById('study-sidebar');
    if (!sidebar) return;
    sidebar.innerHTML = _renderSidebarInner();
    _bindSidebarEvents();
    if (keepSearchFocus) {
      const newInput = document.getElementById('study-search-input');
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      }
    }
  }

  function _bindContentEvents() {
    const prevBtn = document.getElementById('study-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => {
      const idx = _topics.findIndex(t => t.id === _currentTopicId);
      if (idx > 0) _selectTopic(_topics[idx - 1].id);
    });

    const nextBtn = document.getElementById('study-next');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      const idx = _topics.findIndex(t => t.id === _currentTopicId);
      if (idx < _topics.length - 1) _selectTopic(_topics[idx + 1].id);
    });
  }

  function _selectTopic(topicId) {
    if (!_byId[topicId]) return;
    _currentTopicId = topicId;
    _expandedDomains.add(_byId[topicId].domain);

    // Update the URL for deep-linking/reload without triggering a full app re-route
    if (history.replaceState) {
      history.replaceState(null, '', `#study/${topicId}`);
    }

    _rerenderSidebar({});
    const content = document.getElementById('study-content');
    if (content) content.innerHTML = _renderContentInner();
    _bindContentEvents();

    Progress.markTopicRead(topicId);
    content?.scrollTo?.(0, 0);
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
