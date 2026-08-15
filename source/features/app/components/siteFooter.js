import { Utils } from '../../../shared/utils/utils.js';
import { SubmissionService } from '../../submission/classes/submissionService.js';

// =============================================================================
// SITE FOOTER — shows app-wide totals and copyright when logged in.
// =============================================================================
export function renderSiteFooter(app) {
  if (!app.isAuthenticated() || !app.isInstalled()) return '';

  const unit = app.state.appSettings?.weightFormat || 'lb';
  const currency = app.state.appSettings?.currency || '£';

  let totalWeight = 0;
  let totalCash = 0;
  (app.state.users || []).forEach((u) => {
    const stats = SubmissionService.userStats(u, app.state.rounds, app.state.submissions, app.state.users);
    totalWeight += stats.totalWeightDelta || 0;
    totalCash += stats.totalCashWon || 0;
  });

  const currentYear = new Date().getFullYear();
  const rawInstallDate = app.state.appSettings?.installedAt || app.state.appSettings?.installLockedAt || null;
  const installYear = rawInstallDate ? new Date(rawInstallDate).getFullYear() : null;
  const copyrightYears = (!installYear || installYear === currentYear)
    ? String(currentYear)
    : `${installYear} – ${currentYear}`;

  return `<footer class="site-footer">
    <div class="site-footer-inner">
      <div>Fighting the flab since 2026 <span class="material-symbols-rounded" aria-hidden="true" style="vertical-align:middle;font-size:1.1em">lunch_dining</span></div>
      <div>Total weight loss: <strong>${Utils.esc(String(Utils.round2(totalWeight)))}${Utils.esc(unit)}</strong></div>
      <div>Total prize money won: <strong>${Utils.esc(Utils.money(Utils.round2(totalCash), currency))}</strong></div>
      <div class="muted">Website created by skn3. Copyright ${Utils.esc(copyrightYears)}</div>
    </div>
  </footer>`;
}
