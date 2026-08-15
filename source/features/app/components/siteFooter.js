import { Utils } from '../../../shared/utils/utils.js';
import { Domain } from '../../../domain.js';

// =============================================================================
// SITE FOOTER — shows app-wide totals and copyright when logged in.
// =============================================================================
export function renderSiteFooter(app) {
  if (!app.isAuthenticated() || !app.isInstalled()) return '';

  const unit = app.state.appSettings?.weightFormat || 'lb';
  const currency = app.state.appSettings?.currency || '£';

  // Aggregate totals across all rounds (active + completed) and all users
  let totalWeight = 0;
  let totalCash = 0;
  const allRounds = app.state.rounds || [];
  const allSubmissions = app.state.submissions || [];
  const allUsers = app.state.users || [];

  allRounds.forEach((r) => {
    const subs = Domain.submissionsByRound(allSubmissions, r.id);
    if (r.status === 'completed' && r.prizeSplits) {
      const final = Domain.weekView(r, allUsers, subs, r.weeksCount).ranked;
      final.forEach((ranked, i) => {
        totalCash += Utils.safeNum(r.prizeSplits?.[i], 0);
      });
    }
    (r.participantIds || []).forEach((userId) => {
      const first = Domain.firstWeight(subs, userId);
      const latest = Domain.latestWeight(subs, userId, r.weeksCount);
      if (first && latest) totalWeight += Utils.round2(first.weight - latest.weight);
    });
  });
  totalWeight = Utils.round2(totalWeight);
  totalCash = Utils.round2(totalCash);

  const currentYear = new Date().getFullYear();
  const rawInstallDate = app.state.appSettings?.installedAt || app.state.appSettings?.installLockedAt || null;
  const installYear = rawInstallDate ? new Date(rawInstallDate).getFullYear() : null;
  const copyrightYears = (!installYear || installYear === currentYear)
    ? String(currentYear)
    : `${installYear} – ${currentYear}`;

  return `<footer class="site-footer">
    <div class="site-footer-inner">
      <div>Fighting the flab since ${Utils.esc(String(installYear || currentYear))} <span class="material-symbols-rounded" aria-hidden="true" style="vertical-align:middle;font-size:1.1em">lunch_dining</span></div>
      <div>Total weight loss: <strong>${Utils.esc(String(Utils.round2(totalWeight)))}${Utils.esc(unit)}</strong></div>
      <div>Total prize money won: <strong>${Utils.esc(Utils.money(Utils.round2(totalCash), currency))}</strong></div>
      <div class="muted">Website created by skn3. Copyright ${Utils.esc(copyrightYears)}</div>
    </div>
  </footer>`;
}
