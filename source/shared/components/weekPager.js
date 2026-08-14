// =============================================================================
// WEEK PAGER — "◀ Week X of Y ▶" navigation component.
//
// render(selectedWeek, totalWeeks, canGoNext)
//   Returns the week navigation div HTML string.
//
// bind(container, onPrev, onNext)
//   Attaches click handlers to data-week-nav buttons inside container.
// =============================================================================
export const WeekPager = {
  /**
   * Returns the week navigation row HTML.
   * @param {number} selectedWeek
   * @param {number} totalWeeks
   * @param {boolean} canGoNext
   * @returns {string}
   */
  render(selectedWeek, totalWeeks, canGoNext) {
    return `<div class="row between week-nav" style="margin-top:8px">` +
      `<button data-week-nav="prev" ${selectedWeek <= 1 ? 'disabled' : ''}>◀</button>` +
      `<strong>Week ${selectedWeek} of ${totalWeeks}</strong>` +
      `<button data-week-nav="next" ${!canGoNext ? 'disabled' : ''}>▶</button>` +
      `</div>`;
  },

  /**
   * Attaches prev/next click handlers to the pager buttons within container.
   * @param {HTMLElement|null} container
   * @param {function} onPrev
   * @param {function} onNext
   */
  bind(container, onPrev, onNext) {
    if (!container) return;
    container.querySelectorAll('[data-week-nav]').forEach((btn) => {
      btn.onclick = () => {
        if (btn.dataset.weekNav === 'prev' && !btn.disabled) onPrev();
        if (btn.dataset.weekNav === 'next' && !btn.disabled) onNext();
      };
    });
  }
};
