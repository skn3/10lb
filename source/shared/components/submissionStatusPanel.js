import { Domain } from '../../domain.js';
import { Utils } from '../utils/utils.js';

// =============================================================================
// SUBMISSION STATUS PANEL — reusable admin component showing weekly submission
// progress for a given round/week.
//
// options:
//   hideSubmitButton     — omit the "Submit Weights" navigation button
//   hideFinishWeekButton — omit the "Finish Week" navigation button
// =============================================================================
export const SubmissionStatusPanel = {
  /**
   * Returns an HTML string for the submission progress panel.
   * @param {object} round
   * @param {object[]} users
   * @param {object[]} subs - submissions for the round
   * @param {number} week
   * @param {{ hideSubmitButton?: boolean, hideFinishWeekButton?: boolean }} options
   */
  render(round, users, subs, week, options = {}) {
    const participants = Domain.roundUsers(round, users);
    const total = participants.length;

    let submitted = 0;
    participants.forEach((u) => {
      if (Domain.isForfeit(subs, u.id, week)) {
        submitted += 1; // forfeited users count as submitted
        return;
      }
      if (Domain.submissionFor(subs, week, u.id)) submitted += 1;
    });

    const allDone = total > 0 && submitted >= total;
    const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;

    let actionButton = '';
    if (allDone) {
      if (!options.hideFinishWeekButton) {
        actionButton = `<button class="btn" data-go="finish-week">Finish Week</button>`;
      }
    } else {
      if (!options.hideSubmitButton) {
        actionButton = `<button class="btn secondary" data-go="submit">Submit Weights</button>`;
      }
    }

    return `<div class="card submission-status-panel" style="margin-bottom:12px">
      <div class="row between" style="margin-bottom:6px">
        <strong>Week ${Utils.esc(String(week))} submissions</strong>
        <span class="small ${allDone ? 'ok' : 'muted'}">${submitted} / ${total} submitted</span>
      </div>
      <progress value="${submitted}" max="${total}" style="width:100%;height:8px;border-radius:4px"></progress>
      ${actionButton ? `<div class="row" style="margin-top:8px">${actionButton}</div>` : ''}
    </div>`;
  },

  /**
   * Returns a React element for the submission progress panel.
   * @param {object} round
   * @param {object[]} users
   * @param {object[]} subs - submissions for the round
   * @param {number} week
   * @param {{ hideSubmitButton?: boolean, hideFinishWeekButton?: boolean }} options
   * @param {(route: string) => void} onNavigate
   */
  renderReact(round, users, subs, week, options = {}, onNavigate) {
    const React = window.React;
    if (!React) return null;
    const e = React.createElement;

    const participants = Domain.roundUsers(round, users);
    const total = participants.length;

    let submitted = 0;
    participants.forEach((u) => {
      if (Domain.isForfeit(subs, u.id, week)) { submitted += 1; return; }
      if (Domain.submissionFor(subs, week, u.id)) submitted += 1;
    });

    const allDone = total > 0 && submitted >= total;

    let actionButton = null;
    if (allDone) {
      if (!options.hideFinishWeekButton) {
        actionButton = e('button', { type: 'button', className: 'btn', onClick: () => onNavigate?.('finish-week') }, 'Finish Week');
      }
    } else {
      if (!options.hideSubmitButton) {
        actionButton = e('button', { type: 'button', className: 'btn secondary', onClick: () => onNavigate?.('submit') }, 'Submit Weights');
      }
    }

    return e('div', { className: 'card submission-status-panel', style: { marginBottom: '12px' } },
      e('div', { className: 'row between', style: { marginBottom: '6px' } },
        e('strong', null, `Week ${week} submissions`),
        e('span', { className: `small ${allDone ? 'ok' : 'muted'}` }, `${submitted} / ${total} submitted`)
      ),
      e('progress', { value: submitted, max: total, style: { width: '100%', height: '8px', borderRadius: '4px' } }),
      actionButton ? e('div', { className: 'row', style: { marginTop: '8px' } }, actionButton) : null
    );
  }
};
