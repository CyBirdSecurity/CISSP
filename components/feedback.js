/**
 * feedback.js — Renders answer feedback after quiz question
 */

const Feedback = (() => {
  /**
   * Render feedback HTML for a question after an answer is selected
   * @param {Object} question - The question object
   * @param {number} selectedIndex - 0-based index of the selected option
   */
  function render(question, selectedIndex) {
    const isCorrect = selectedIndex === question.correct_answer;
    const incorrectExp = question.explanations.incorrect
      ? (question.explanations.incorrect[selectedIndex] || '')
      : '';

    return `
      <div class="feedback ${isCorrect ? 'feedback--correct' : 'feedback--incorrect'}">
        <div class="feedback-header">
          <span class="feedback-badge ${isCorrect ? 'feedback-badge--correct' : 'feedback-badge--incorrect'}">
            ${isCorrect
              ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Correct'
              : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Incorrect'}
          </span>
        </div>

        ${!isCorrect ? `
          <div class="feedback-section">
            <div class="feedback-label">Your Answer</div>
            <div class="feedback-answer feedback-answer--wrong">
              <span class="feedback-answer-icon">✗</span>
              ${escapeHTML(question.options[selectedIndex])}
            </div>
            ${incorrectExp ? `<p class="feedback-explanation">${escapeHTML(incorrectExp)}</p>` : ''}
          </div>
        ` : ''}

        <div class="feedback-section">
          <div class="feedback-label">Correct Answer</div>
          <div class="feedback-answer feedback-answer--correct">
            <span class="feedback-answer-icon">✓</span>
            ${escapeHTML(question.options[question.correct_answer])}
          </div>
          <p class="feedback-explanation">${escapeHTML(question.explanations.correct)}</p>
        </div>

        ${question.explanation ? `
          <details class="feedback-deep">
            <summary>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Deep Explanation
            </summary>
            <div class="feedback-deep-body">${escapeHTML(question.explanation)}</div>
          </details>
        ` : ''}
      </div>
    `;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return { render };
})();
