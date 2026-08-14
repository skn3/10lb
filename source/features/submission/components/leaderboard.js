import { Domain } from '../../../domain.js';
import { PrizeMedals } from '../../../constants.js';
import { Utils } from '../../../shared/utils/utils.js';
import { WeightChart } from '../../../shared/components/weightChart.js';

// =============================================================================
// LEADERBOARD — leaderboard card component.
//
// render(view, round, appSettings, prizeRanks)
//   Returns the full leaderboard card HTML string including the table,
//   holiday/forfeit/pending lists, and chart canvas placeholder.
//
// renderRow(r, rank, prizeRanks, unit)
//   Returns a single <tr> HTML string for one ranked participant.
// =============================================================================

export const Leaderboard = {
  /**
   * Full leaderboard card.
   * @param {object} view        Domain.weekView() result
   * @param {object} round
   * @param {object} appSettings
   * @param {number[]} prizeRanks  indices of prize-winning ranks
   * @returns {string}
   */
  render(view, round, appSettings, prizeRanks) {
    const unit = appSettings.weightFormat || 'lb';
    const rows = view.ranked.map((r, i) => this.renderRow(r, i + 1, prizeRanks, unit)).join('') ||
      '<tr><td colspan="5" class="muted">No leaderboard data yet.</td></tr>';

    const holidayHtml = view.holiday.length
      ? `<h4>Holiday</h4><ul>${view.holiday.map((x) =>
          `<li class="holiday">${Utils.esc(Utils.fullName(x.user))} (used ${x.holidaysUsed}/${round.holidaysAllowed})</li>`
        ).join('')}</ul>`
      : '';
    const forfeitHtml = view.forfeit.length
      ? `<h4>Forfeit</h4><ul>${view.forfeit.map((x) =>
          `<li class="forfeit">${Utils.esc(Utils.fullName(x.user))}</li>`
        ).join('')}</ul>`
      : '';
    const pendingHtml = view.pending.length
      ? `<h4>Pending</h4><ul>${view.pending.map((x) =>
          `<li>${Utils.esc(Utils.fullName(x.user))}</li>`
        ).join('')}</ul>`
      : '';

    return `<div class="card" style="margin-top:10px"><strong>Leaderboard</strong>
      <table class="table"><thead><tr><th>Rank</th><th>User</th><th>% Lost</th><th>This Week</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody></table>
      ${holidayHtml}${forfeitHtml}${pendingHtml}
      <div style="margin-top:12px">${WeightChart.renderPlaceholder()}</div>
    </div>`;
  },

  /**
   * Single leaderboard table row.
   * @param {object} r          ranked entry from Domain.weekView().ranked
   * @param {number} rank       1-based rank
   * @param {number[]} prizeRanks
   * @param {string} unit
   * @returns {string}
   */
  renderRow(r, rank, prizeRanks, unit) {
    const prize = prizeRanks.includes(rank - 1) ? ` ${PrizeMedals[rank - 1] || '🏅'}` : '';
    const delta = r.weeklyLoss > 0
      ? `<span class="arrow-loss">⬇ ${r.weeklyLoss}${unit}</span>`
      : r.weeklyLoss < 0
        ? `<span class="arrow-gain">⬆ ${Math.abs(r.weeklyLoss)}${unit}</span>`
        : '—';
    return `<tr><td>${rank}${prize}</td><td>${Utils.esc(Utils.fullName(r.user))}</td>` +
      `<td>${Utils.pct(r.percentLoss)}</td><td>${delta}</td><td>${r.totalLoss}${unit}</td></tr>`;
  }
};
