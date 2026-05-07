/**
 * interactive.js — Renderers and event handlers for interactive question types:
 *   ordering   — drag/arrow to sort a list into correct sequence
 *   matching   — click-to-assign items to categories
 *   multiselect — check all that apply
 *   fillblank  — select the missing term in a template sentence
 */

const InteractiveRenderer = (() => {

  // ── Per-question module state (reset on each new question) ────
  let _currentOrder = [];    // ordering: original-index array in current display order
  let _assignments  = {};    // matching: { itemIdx: categoryName }
  let _selectedItem = null;  // matching: which item chip is currently selected
  let _checkedSet   = new Set(); // multiselect: checked original indices
  let _blankChoice  = null;  // fillblank: selected choice index
  let _onAnswer     = null;  // stored callback so re-renders can rebind

  // ── Utilities ─────────────────────────────────────────────────
  function _esc(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _svgCheck() {
    return '<svg class="iq-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
  }

  function _svgX() {
    return '<svg class="iq-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  }

  // ── Public: reset state for a new question ────────────────────
  function reset(q) {
    _assignments  = {};
    _selectedItem = null;
    _checkedSet   = new Set();
    _blankChoice  = null;
    _onAnswer     = null;

    if (q.type === 'ordering') {
      // Start shuffled so question isn't trivially already correct
      _currentOrder = q.items.map((_, i) => i);
      for (let i = _currentOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [_currentOrder[i], _currentOrder[j]] = [_currentOrder[j], _currentOrder[i]];
      }
      // Guard: if shuffle landed on the correct order, rotate one step
      if (_currentOrder.every((v, i) => v === q.correct_order[i]) && _currentOrder.length > 1) {
        _currentOrder.push(_currentOrder.shift());
      }
    }
  }

  // ── Public: render HTML for question body ─────────────────────
  function render(q, answered, userAnswer) {
    switch (q.type) {
      case 'multiselect': return _renderMultiselect(q, answered, userAnswer);
      case 'fillblank':   return _renderFillblank(q, answered, userAnswer);
      case 'ordering':    return _renderOrdering(q, answered, userAnswer);
      case 'matching':    return _renderMatching(q, answered, userAnswer);
      default: return `<p style="color:var(--c-red)">Unknown interactive type: ${_esc(q.type)}</p>`;
    }
  }

  // ── Public: bind all interaction events ───────────────────────
  function bindEvents(q, onAnswer) {
    _onAnswer = onAnswer;
    switch (q.type) {
      case 'multiselect': _bindMultiselect(q); break;
      case 'fillblank':   _bindFillblank(q);   break;
      case 'ordering':    _bindOrdering(q);    break;
      case 'matching':    _bindMatching(q);    break;
    }
  }

  // Replaces just the #question-body innerHTML and re-binds events.
  // Used by ordering/matching to reflect incremental state changes.
  function _refreshBody(q) {
    const body = document.getElementById('question-body');
    if (!body) return;
    body.innerHTML = render(q, false, null);
    bindEvents(q, _onAnswer);
  }

  // ── Feedback rendered after a question is answered ────────────
  function renderFeedback(q, answer) {
    const correct = QuizEngine.isCorrectAnswer(q, answer);
    return `
      <div class="feedback ${correct ? 'feedback--correct' : 'feedback--incorrect'}">
        <div class="feedback-header">
          <span class="feedback-badge ${correct ? 'feedback-badge--correct' : 'feedback-badge--incorrect'}">
            ${correct
              ? `${_svgCheck()} Correct`
              : `${_svgX()} Incorrect`}
          </span>
        </div>
        <div class="feedback-section">
          ${_renderAnswerSummary(q, answer)}
        </div>
        <details class="feedback-deep" open>
          <summary>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Explanation
          </summary>
          <div class="feedback-deep-body">${_esc(q.explanation)}</div>
        </details>
      </div>
    `;
  }

  // Short text summary used in the results-page incorrect list
  function summarizeAnswer(q, answer) {
    switch (q.type) {
      case 'multiselect': {
        const yourLabels = Array.isArray(answer)
          ? answer.map(i => _esc(q.options[i])).join(', ')
          : 'Unanswered';
        const correctLabels = q.correct_answers.map(i => _esc(q.options[i])).join(', ');
        return { your: yourLabels, correct: correctLabels };
      }
      case 'fillblank':
        return {
          your:    answer !== null && answer !== undefined ? _esc(q.choices[answer]) : 'Unanswered',
          correct: _esc(q.choices[q.correct_answer])
        };
      case 'ordering': {
        const yourOrder = Array.isArray(answer)
          ? answer.map(i => _esc(q.items[i])).join(' → ')
          : 'Unanswered';
        const correctOrder = q.correct_order.map(i => _esc(q.items[i])).join(' → ');
        return { your: yourOrder, correct: correctOrder };
      }
      case 'matching': {
        if (!answer) return { your: 'Unanswered', correct: '' };
        const yourPairs = q.items.map((item, idx) =>
          `${_esc(item)} → ${_esc(answer[idx] || '?')}`
        ).join(', ');
        const correctPairs = q.items.map((item, idx) =>
          `${_esc(item)} → ${_esc(q.correct_mapping[idx])}`
        ).join(', ');
        return { your: yourPairs, correct: correctPairs };
      }
      default:
        return { your: String(answer), correct: '' };
    }
  }

  // ════════════════════════════════════════════════════════════
  //  MULTISELECT
  // ════════════════════════════════════════════════════════════

  function _renderMultiselect(q, answered, userAnswer) {
    return `
      <div class="iq-multiselect">
        ${!answered ? '<p class="iq-instruction">Select all that apply, then click Submit.</p>' : ''}
        <div class="iq-ms-options" id="ms-options">
          ${q.options.map((opt, i) => {
            let cls = 'iq-ms-option';
            if (!answered) {
              if (_checkedSet.has(i)) cls += ' is-checked';
            } else {
              const wasChecked  = Array.isArray(userAnswer) && userAnswer.includes(i);
              const isCorrectOpt = q.correct_answers.includes(i);
              if (isCorrectOpt)              cls += ' is-correct';
              if (wasChecked && !isCorrectOpt) cls += ' is-wrong';
            }
            return `
              <label class="${cls}" data-idx="${i}">
                <span class="iq-ms-checkbox">
                  ${!answered && _checkedSet.has(i) ? _svgCheck() : ''}
                  ${answered && q.correct_answers.includes(i) ? _svgCheck() : ''}
                  ${answered && Array.isArray(userAnswer) && userAnswer.includes(i) && !q.correct_answers.includes(i) ? _svgX() : ''}
                </span>
                <span class="iq-ms-letter">${String.fromCharCode(65 + i)}</span>
                <span class="iq-ms-text">${_esc(opt)}</span>
              </label>
            `;
          }).join('')}
        </div>
        ${!answered
          ? `<div class="iq-submit-row">
               <button class="btn btn-primary" id="iq-submit" ${_checkedSet.size === 0 ? 'disabled' : ''}>
                 Submit Answer
               </button>
             </div>`
          : ''}
      </div>
    `;
  }

  function _bindMultiselect(q) {
    document.querySelectorAll('.iq-ms-option').forEach(label => {
      label.addEventListener('click', () => {
        const idx = parseInt(label.dataset.idx);
        if (_checkedSet.has(idx)) {
          _checkedSet.delete(idx);
        } else {
          _checkedSet.add(idx);
        }
        _refreshBody(q);
      });
    });

    const submitBtn = document.getElementById('iq-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        _onAnswer && _onAnswer([..._checkedSet].sort((a, b) => a - b));
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  //  FILL-IN-THE-BLANK
  // ════════════════════════════════════════════════════════════

  function _renderFillblank(q, answered, userAnswer) {
    const parts = q.template.split('{blank}');
    let blankHtml;
    if (!answered) {
      blankHtml = _blankChoice !== null
        ? `<span class="blank-slot blank-filled-preview">${_esc(q.choices[_blankChoice])}</span>`
        : `<span class="blank-slot">______</span>`;
    } else {
      const correct = userAnswer === q.correct_answer;
      blankHtml = `<span class="blank-slot ${correct ? 'blank-correct' : 'blank-wrong'}">${_esc(q.choices[userAnswer])}</span>`;
    }

    const templateHtml = _esc(parts[0]) + blankHtml + _esc(parts[1] || '');

    return `
      <div class="iq-fillblank">
        <p class="iq-template">${templateHtml}</p>
        <div class="iq-fb-choices" id="fb-choices">
          ${q.choices.map((choice, i) => {
            let cls = 'iq-fb-choice';
            if (!answered) {
              if (_blankChoice === i) cls += ' is-selected';
            } else {
              if (i === q.correct_answer)                                  cls += ' is-correct';
              else if (i === userAnswer && i !== q.correct_answer)         cls += ' is-wrong';
            }
            return `
              <button class="${cls}" data-idx="${i}" ${answered ? 'disabled' : ''}>
                ${_esc(choice)}
                ${answered && i === q.correct_answer ? _svgCheck() : ''}
                ${answered && i === userAnswer && i !== q.correct_answer ? _svgX() : ''}
              </button>
            `;
          }).join('')}
        </div>
        ${!answered
          ? `<div class="iq-submit-row">
               <button class="btn btn-primary" id="iq-submit" ${_blankChoice === null ? 'disabled' : ''}>
                 Submit Answer
               </button>
             </div>`
          : ''}
      </div>
    `;
  }

  function _bindFillblank(q) {
    document.querySelectorAll('.iq-fb-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        _blankChoice = parseInt(btn.dataset.idx);
        _refreshBody(q);
      });
    });

    const submitBtn = document.getElementById('iq-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        if (_blankChoice !== null) _onAnswer && _onAnswer(_blankChoice);
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  //  ORDERING
  // ════════════════════════════════════════════════════════════

  function _buildSortItems(q, answered, userAnswer) {
    const order = answered ? userAnswer : _currentOrder;
    return order.map((origIdx, pos) => {
      let cls = 'iq-sort-item';
      if (answered) {
        cls += origIdx === q.correct_order[pos] ? ' is-correct' : ' is-wrong';
      }
      return `
        <li class="${cls}" data-pos="${pos}" data-orig="${origIdx}" ${!answered ? 'draggable="true"' : ''}>
          ${!answered ? '<span class="sort-handle" aria-hidden="true">&#8942;</span>' : ''}
          <span class="sort-pos">${pos + 1}.</span>
          <span class="sort-text">${_esc(q.items[origIdx])}</span>
          ${answered
            ? (origIdx === q.correct_order[pos] ? _svgCheck() : _svgX())
            : `<div class="sort-arrows">
                 <button class="sort-up" data-pos="${pos}" ${pos === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
                 <button class="sort-dn" data-pos="${pos}" ${pos === order.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
               </div>`
          }
        </li>
      `;
    }).join('');
  }

  function _renderOrdering(q, answered, userAnswer) {
    return `
      <div class="iq-ordering">
        ${!answered ? '<p class="iq-instruction">Drag items or use the arrows to arrange them in the correct order.</p>' : ''}
        <ol class="iq-sort-list" id="sort-list">
          ${_buildSortItems(q, answered, userAnswer)}
        </ol>
        ${answered
          ? `<div class="iq-order-reveal">
               <p class="iq-answer-label">Correct order:</p>
               <ol class="iq-sort-list iq-sort-list--reference">
                 ${q.correct_order.map((origIdx, pos) => `
                   <li class="iq-sort-item is-reference">
                     <span class="sort-pos">${pos + 1}.</span>
                     <span class="sort-text">${_esc(q.items[origIdx])}</span>
                   </li>
                 `).join('')}
               </ol>
             </div>`
          : `<div class="iq-submit-row">
               <button class="btn btn-primary" id="iq-submit">Submit Order</button>
             </div>`
        }
      </div>
    `;
  }

  function _bindOrdering(q) {
    _bindOrderingControls(q);

    const submitBtn = document.getElementById('iq-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        _onAnswer && _onAnswer([..._currentOrder]);
      });
    }
  }

  function _bindOrderingControls(q) {
    const list = document.getElementById('sort-list');
    if (!list) return;

    // ↑/↓ arrow buttons
    list.querySelectorAll('.sort-up').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const pos = parseInt(btn.dataset.pos);
        if (pos > 0) {
          [_currentOrder[pos], _currentOrder[pos - 1]] = [_currentOrder[pos - 1], _currentOrder[pos]];
          // Re-render only the list contents, not the whole body
          list.innerHTML = _buildSortItems(q, false, null);
          _bindOrderingControls(q);
        }
      });
    });

    list.querySelectorAll('.sort-dn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const pos = parseInt(btn.dataset.pos);
        if (pos < _currentOrder.length - 1) {
          [_currentOrder[pos], _currentOrder[pos + 1]] = [_currentOrder[pos + 1], _currentOrder[pos]];
          list.innerHTML = _buildSortItems(q, false, null);
          _bindOrderingControls(q);
        }
      });
    });

    // HTML5 drag-and-drop (desktop)
    let dragSrcPos = null;

    list.querySelectorAll('[draggable="true"]').forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrcPos = parseInt(item.dataset.pos);
        item.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Required for Firefox
        e.dataTransfer.setData('text/plain', String(dragSrcPos));
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('is-dragging');
        list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });

      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        item.classList.add('drag-over');
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', e => {
        e.preventDefault();
        item.classList.remove('drag-over');
        const destPos = parseInt(item.dataset.pos);
        if (dragSrcPos !== null && dragSrcPos !== destPos) {
          const [moved] = _currentOrder.splice(dragSrcPos, 1);
          _currentOrder.splice(destPos, 0, moved);
          list.innerHTML = _buildSortItems(q, false, null);
          _bindOrderingControls(q);
        }
        dragSrcPos = null;
      });
    });
  }

  // ════════════════════════════════════════════════════════════
  //  MATCHING
  // ════════════════════════════════════════════════════════════

  function _renderMatching(q, answered, userAnswer) {
    const assignments = answered ? userAnswer : _assignments;

    // Build reverse map: categoryName → [itemIdx, ...]
    const catMap = {};
    q.categories.forEach(cat => { catMap[cat] = []; });
    Object.entries(assignments).forEach(([idx, cat]) => {
      if (catMap[cat] !== undefined) catMap[cat].push(parseInt(idx));
    });

    const assignedSet = new Set(Object.keys(assignments).map(Number));

    return `
      <div class="iq-matching">
        ${!answered
          ? `<p class="iq-instruction">
               ${_selectedItem !== null
                 ? 'Now click a category to assign the selected item.'
                 : 'Click an item to select it, then click a category to assign it.'}
             </p>`
          : ''}

        <div class="iq-match-layout">

          <!-- Left: unassigned items -->
          <div class="iq-match-items-col">
            <div class="iq-col-label">Items</div>
            <div class="iq-match-items" id="match-items">
              ${q.items.map((item, i) => {
                if (assignedSet.has(i)) return ''; // already placed
                let cls = 'iq-match-item';
                if (!answered && _selectedItem === i) cls += ' is-selected';
                return `<div class="${cls}" data-idx="${i}">${_esc(item)}</div>`;
              }).join('')}
              ${assignedSet.size === q.items.length && !answered
                ? '<div class="iq-match-all-placed">All items placed</div>'
                : ''}
            </div>
          </div>

          <!-- Right: category buckets -->
          <div class="iq-match-cats-col">
            <div class="iq-col-label">Categories</div>
            <div class="iq-match-cats" id="match-cats">
              ${q.categories.map(cat => {
                const itemsHere = catMap[cat] || [];
                const isActive = !answered && _selectedItem !== null;
                return `
                  <div class="iq-match-cat ${isActive ? 'is-droppable' : ''}" data-cat="${_esc(cat)}">
                    <div class="iq-cat-label">${_esc(cat)}</div>
                    <div class="iq-cat-zone">
                      ${itemsHere.map(idx => {
                        let cls = 'iq-assigned-item';
                        if (answered) {
                          cls += String(q.correct_mapping[idx]) === cat ? ' is-correct' : ' is-wrong';
                        }
                        return `
                          <div class="${cls}">
                            <span class="iq-assigned-text">${_esc(q.items[idx])}</span>
                            ${!answered
                              ? `<button class="iq-unassign" data-idx="${idx}" aria-label="Remove">&times;</button>`
                              : (String(q.correct_mapping[idx]) === cat ? _svgCheck() : _svgX())}
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

        </div>

        ${!answered
          ? `<div class="iq-submit-row">
               <button class="btn btn-primary" id="iq-submit"
                 ${assignedSet.size < q.items.length ? 'disabled' : ''}>
                 Submit Answer
               </button>
             </div>`
          : ''}
      </div>
    `;
  }

  function _bindMatching(q) {
    const container = document.querySelector('.iq-matching');
    if (!container) return;

    container.addEventListener('click', e => {
      // Unassign button
      const unassignBtn = e.target.closest('.iq-unassign');
      if (unassignBtn) {
        const idx = parseInt(unassignBtn.dataset.idx);
        delete _assignments[idx];
        _selectedItem = null;
        _refreshBody(q);
        return;
      }

      // Item chip click — select or deselect
      const itemEl = e.target.closest('.iq-match-item');
      if (itemEl && document.getElementById('match-items')?.contains(itemEl)) {
        const idx = parseInt(itemEl.dataset.idx);
        _selectedItem = _selectedItem === idx ? null : idx;
        _refreshBody(q);
        return;
      }

      // Category click — assign selected item
      if (_selectedItem !== null) {
        const catEl = e.target.closest('.iq-match-cat');
        if (catEl && catEl.dataset.cat) {
          _assignments[_selectedItem] = catEl.dataset.cat;
          _selectedItem = null;
          _refreshBody(q);
        }
      }
    });

    const submitBtn = document.getElementById('iq-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        _onAnswer && _onAnswer({ ..._assignments });
      });
    }
  }

  // ── Internal: answered-state summary HTML used in feedback ────
  function _renderAnswerSummary(q, answer) {
    switch (q.type) {
      case 'multiselect': {
        const correct = q.correct_answers;
        return `
          <div class="feedback-label">Your selections vs. correct answers:</div>
          <div class="iq-feedback-ms">
            ${q.options.map((opt, i) => {
              const wasChecked    = Array.isArray(answer) && answer.includes(i);
              const shouldCheck   = correct.includes(i);
              let cls = 'iq-fb-ms-row';
              if (shouldCheck)              cls += ' is-correct';
              if (wasChecked && !shouldCheck) cls += ' is-wrong';
              return `
                <div class="${cls}">
                  ${shouldCheck ? _svgCheck() : (wasChecked ? _svgX() : '<span class="iq-fb-neutral">–</span>')}
                  <span>${_esc(opt)}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      case 'fillblank': {
        const correct = answer === q.correct_answer;
        return `
          <div class="feedback-label">${correct ? 'You filled in:' : 'You selected:'}</div>
          <div class="feedback-answer ${correct ? 'feedback-answer--correct' : 'feedback-answer--wrong'}">
            ${correct ? _svgCheck() : _svgX()}
            ${_esc(q.choices[answer])}
          </div>
          ${!correct ? `
            <div class="feedback-label" style="margin-top:10px">Correct answer:</div>
            <div class="feedback-answer feedback-answer--correct">
              ${_svgCheck()} ${_esc(q.choices[q.correct_answer])}
            </div>` : ''}
        `;
      }

      case 'ordering': {
        const userOrder = Array.isArray(answer) ? answer : [];
        return `
          <div class="iq-feedback-order">
            <div class="iq-fo-col">
              <div class="feedback-label">Your order</div>
              <ol class="iq-fo-list">
                ${userOrder.map((origIdx, pos) => {
                  const isRight = origIdx === q.correct_order[pos];
                  return `<li class="iq-fo-item ${isRight ? 'is-correct' : 'is-wrong'}">
                    ${isRight ? _svgCheck() : _svgX()}
                    ${_esc(q.items[origIdx])}
                  </li>`;
                }).join('')}
              </ol>
            </div>
            <div class="iq-fo-col">
              <div class="feedback-label">Correct order</div>
              <ol class="iq-fo-list">
                ${q.correct_order.map(origIdx => `
                  <li class="iq-fo-item is-reference">${_esc(q.items[origIdx])}</li>
                `).join('')}
              </ol>
            </div>
          </div>
        `;
      }

      case 'matching': {
        if (!answer) return '<div class="feedback-label">Unanswered</div>';
        return `
          <div class="feedback-label">Your assignments:</div>
          <div class="iq-feedback-match">
            ${q.items.map((item, idx) => {
              const yours   = String(answer[idx] || '?');
              const correct = String(q.correct_mapping[idx]);
              const isRight = yours === correct;
              return `
                <div class="iq-fm-row ${isRight ? 'is-correct' : 'is-wrong'}">
                  ${isRight ? _svgCheck() : _svgX()}
                  <span class="iq-fm-item">${_esc(item)}</span>
                  <span class="iq-fm-arrow">→</span>
                  <span class="iq-fm-cat">${_esc(yours)}</span>
                  ${!isRight ? `<span class="iq-fm-correct">(correct: ${_esc(correct)})</span>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      default:
        return '';
    }
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    reset,
    render,
    bindEvents,
    renderFeedback,
    summarizeAnswer
  };
})();
