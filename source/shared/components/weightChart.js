import { Domain } from '../../domain.js';
import { Utils } from '../utils/utils.js';

// =============================================================================
// WEIGHT CHART — Chart.js weight-loss line chart component.
//
// renderPlaceholder() — returns `<canvas id="weight-chart" height="220">` HTML.
//
// attach(round, users, subs, selectedWeek, unit, existingInstance)
//   Builds and returns a new Chart.js instance for the weight-loss chart.
//   Destroys existingInstance first if provided.
//   Returns null when the chart cannot be rendered (no data / Chart.js absent).
//
// destroy(instance) — safely destroys a Chart.js instance.
// =============================================================================
export const WeightChart = {
  CANVAS_ID: 'weight-chart',

  /** Returns the canvas placeholder HTML to embed in a page. */
  renderPlaceholder() {
    return `<canvas id="${this.CANVAS_ID}" height="220"></canvas>`;
  },

  /**
   * Creates (or replaces) the Chart.js chart.
   * @param {object} round
   * @param {object[]} users
   * @param {object[]} subs
   * @param {number} selectedWeek
   * @param {string} unit  e.g. 'lb' or 'kg'
   * @param {object|null} existingInstance  previous Chart instance to destroy
   * @returns {object|null} new Chart instance or null
   */
  attach(round, users, subs, selectedWeek, unit, existingInstance = null) {
    const canvas = document.getElementById(this.CANVAS_ID);
    if (!canvas || typeof Chart === 'undefined') return null;
    if (!round || selectedWeek < 2) return null;

    const participants = Domain.roundUsers(round, users);
    const colors = [
      '#0f766e', '#4338ca', '#be123c', '#d97706',
      '#047857', '#7c3aed', '#db2777', '#0369a1',
      '#65a30d', '#dc2626'
    ];
    const labels = [];
    for (let w = 1; w <= selectedWeek; w++) labels.push(`Wk ${w}`);

    const datasets = [];
    participants.forEach((u, idx) => {
      const startSub = Domain.firstWeight(subs, u.id);
      if (!startSub) return;
      const startWeight = Utils.safeNum(startSub.weight);
      if (!startWeight) return;
      const data = [];
      for (let w = 1; w <= selectedWeek; w++) {
        if (Domain.isForfeit(subs, u.id, w)) { data.push(null); continue; }
        const sub = Domain.submissionFor(subs, w, u.id);
        if (!sub || sub.type === 'holiday' || sub.type !== 'weight') { data.push(null); continue; }
        data.push(Utils.round2(startWeight - Utils.safeNum(sub.weight)));
      }
      if (data.every((d) => d === null)) return;
      datasets.push({
        label: Utils.fullName(u),
        data,
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length] + '22',
        tension: 0.3,
        spanGaps: false,
        pointRadius: 4
      });
    });

    if (!datasets.length) return null;

    this.destroy(existingInstance);

    return new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: `Weight loss journey (${unit})` }
        },
        scales: {
          y: {
            title: { display: true, text: `Total loss (${unit})` },
            ticks: { callback: (v) => `${v}${unit}` }
          },
          x: { title: { display: true, text: 'Week' } }
        }
      }
    });
  },

  /**
   * Safely destroys a Chart.js instance.
   * @param {object|null} instance
   */
  destroy(instance) {
    if (instance) {
      try { instance.destroy(); } catch { /* ignore */ }
    }
  }
};
