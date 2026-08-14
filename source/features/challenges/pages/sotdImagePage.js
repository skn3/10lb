import { Domain } from '../../../domain.js';
import { PrizeMedals } from '../../../constants.js';
import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';

// =============================================================================
// SOTD IMAGE PAGE — Snapshot Of The Day: renders leaderboard + chart to canvas
// for social media sharing.
// =============================================================================

const CANVAS_ID = 'sotd-canvas';

export function renderSotdImagePage(app) {
  if (!app.isAdmin()) return app._renderDenied();
  const round = app.currentRound();
  if (!round) return `<div class="card"><p class="muted">No round selected.</p></div>`;

  const subs = Domain.submissionsByRound(app.state.submissions, round.id);
  const currentWeek = Domain.calcCurrentWeek(round, app.state.users, subs);
  const selectedWeek = app.state.weekCursor[round.id] || Math.min(currentWeek, round.weeksCount);

  return `<div class="card">
    <h2 style="margin-top:0">SOTD Image — Week ${selectedWeek}</h2>
    <p class="muted small">Snapshot Of The Day: leaderboard and weight chart rendered as a shareable image.</p>
    <canvas id="${CANVAS_ID}" style="width:100%;border:1px solid var(--color-border);border-radius:8px;margin-top:8px"></canvas>
    <div class="row" style="margin-top:12px">
      ${SubmitButton.render({ text: 'Download Image', icon: 'download', attrs: { id: 'sotd-download' } })}
      ${SubmitButton.render({ text: 'Share to Facebook', icon: 'share', theme: 'secondary', attrs: { id: 'sotd-facebook' } })}
      ${SubmitButton.render({ text: 'Back', icon: 'arrow_back', theme: 'secondary', attrs: { 'data-go': 'overview' } })}
    </div>
    <p class="muted small" style="margin-top:8px">Note: Facebook image sharing requires the image to be hosted at a public URL. Use "Download Image" first, then upload to your post.</p>
  </div>`;
}

export function bindSotdImageEvents(app) {
  const canvas = document.getElementById(CANVAS_ID);
  if (!canvas) return;

  const round = app.currentRound();
  if (!round) return;

  const subs = Domain.submissionsByRound(app.state.submissions, round.id);
  const currentWeek = Domain.calcCurrentWeek(round, app.state.users, subs);
  const selectedWeek = app.state.weekCursor[round.id] || Math.min(currentWeek, round.weeksCount);
  const view = Domain.weekView(round, app.state.users, subs, selectedWeek);
  const prizeRanks = Domain.payoutRankIndices(round);
  const unit = app.state.appSettings.weightFormat || 'lb';

  // Portrait dimensions: 1080×1920 (9:16)
  const W = 1080;
  const PADDING = 40;
  const ctx = canvas.getContext('2d');

  // --- Build leaderboard rows to measure height needed ---
  const headerRow = ['Rank', 'Name', '% Lost', 'This Week', 'Total'];
  const dataRows = view.ranked.map((r, i) => {
    const rank = i + 1;
    const prize = prizeRanks.includes(i) ? ` ${PrizeMedals[i] || '🏅'}` : '';
    const delta = r.weeklyLoss > 0 ? `⬇ ${r.weeklyLoss}${unit}` : r.weeklyLoss < 0 ? `⬆ ${Math.abs(r.weeklyLoss)}${unit}` : '—';
    return [`${rank}${prize}`, Utils.fullName(r.user), Utils.pct(r.percentLoss), delta, `${r.totalLoss}${unit}`];
  });

  const ROW_H = 50;
  const TABLE_HEADER_H = 56;
  const leaderboardH = TABLE_HEADER_H + dataRows.length * ROW_H;
  const CHART_H = 400;
  const TITLE_H = 100;
  const FOOTER_H = 60;
  const SECTION_GAP = 32;

  const H = TITLE_H + leaderboardH + SECTION_GAP + CHART_H + FOOTER_H + PADDING * 2;

  canvas.width = W;
  canvas.height = H;

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  let y = PADDING;

  // --- Title ---
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(round.title || round.id, W / 2, y + 52);
  ctx.font = '32px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Week ${selectedWeek} of ${round.weeksCount}`, W / 2, y + 96);
  y += TITLE_H;

  // --- Leaderboard table ---
  ctx.textAlign = 'left';
  const colWidths = [100, 280, 180, 220, 180];
  const colX = [];
  let cx = PADDING;
  colWidths.forEach((w) => { colX.push(cx); cx += w; });

  // Header row bg
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(PADDING, y, W - PADDING * 2, TABLE_HEADER_H);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 28px system-ui, sans-serif';
  headerRow.forEach((h, i) => {
    ctx.fillText(h, colX[i] + 10, y + 36);
  });
  y += TABLE_HEADER_H;

  dataRows.forEach((row, ri) => {
    ctx.fillStyle = ri % 2 === 0 ? '#0f172a' : '#1e293b';
    ctx.fillRect(PADDING, y, W - PADDING * 2, ROW_H);
    ctx.fillStyle = ri === 0 ? '#fbbf24' : ri === 1 ? '#94a3b8' : ri === 2 ? '#cd7c2f' : '#f1f5f9';
    ctx.font = ri < 3 ? 'bold 26px system-ui, sans-serif' : '26px system-ui, sans-serif';
    row.forEach((cell, i) => {
      ctx.fillText(cell, colX[i] + 10, y + 33);
    });
    y += ROW_H;
  });

  if (!dataRows.length) {
    ctx.fillStyle = '#64748b';
    ctx.font = '26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No leaderboard data yet.', W / 2, y + 33);
    y += ROW_H;
    ctx.textAlign = 'left';
  }

  y += SECTION_GAP;

  // --- Weight chart (using Chart.js offscreen if available) ---
  _drawChart(ctx, round, app.state.users, subs, selectedWeek, unit, PADDING, y, W - PADDING * 2, CHART_H);
  y += CHART_H;

  // --- Footer ---
  ctx.fillStyle = '#475569';
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Generated by 10lb Challenge', W / 2, y + 36);

  // --- Wire up buttons ---
  const dlBtn = document.getElementById('sotd-download');
  if (dlBtn) {
    dlBtn.onclick = () => {
      const a = document.createElement('a');
      a.download = `sotd-week-${selectedWeek}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
  }

  const fbBtn = document.getElementById('sotd-facebook');
  if (fbBtn) {
    fbBtn.onclick = () => {
      const shareUrl = encodeURIComponent(window.location.href);
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`, '_blank', 'width=600,height=400');
    };
  }
}

// ---------------------------------------------------------------------------
// Internal: draw the weight-loss chart onto an existing canvas context
// ---------------------------------------------------------------------------
function _drawChart(ctx, round, users, subs, selectedWeek, unit, x, y, w, h) {
  if (typeof Chart === 'undefined' || selectedWeek < 2) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#64748b';
    ctx.font = '26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Chart not available', x + w / 2, y + h / 2);
    return;
  }

  // Create an offscreen canvas for Chart.js
  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  offscreen.style.display = 'none';
  document.body.appendChild(offscreen);

  const colors = [
    '#0f766e', '#4338ca', '#be123c', '#d97706',
    '#047857', '#7c3aed', '#db2777', '#0369a1',
    '#65a30d', '#dc2626'
  ];
  const labels = [];
  for (let wk = 1; wk <= selectedWeek; wk++) labels.push(`Wk ${wk}`);

  const participants = Domain.roundUsers(round, users);
  const datasets = [];
  participants.forEach((u, idx) => {
    const startSub = Domain.firstWeight(subs, u.id);
    if (!startSub) return;
    const startWeight = Utils.safeNum(startSub.weight);
    if (!startWeight) return;
    const data = [];
    let lastValue = null;
    for (let wk = 1; wk <= selectedWeek; wk++) {
      if (Domain.isForfeit(subs, u.id, wk)) { data.push(null); continue; }
      const sub = Domain.submissionFor(subs, wk, u.id);
      if (!sub || sub.type === 'holiday') { data.push(lastValue); continue; }
      if (sub.type !== 'weight') { data.push(null); continue; }
      const v = Utils.round2(startWeight - Utils.safeNum(sub.weight));
      lastValue = v;
      data.push(v);
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

  if (!datasets.length) {
    document.body.removeChild(offscreen);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, w, h);
    return;
  }

  const chart = new Chart(offscreen, {
    type: 'line',
    data: { labels, datasets },
    options: {
      animation: false,
      responsive: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#f1f5f9' } },
        title: { display: true, text: `Weight loss journey (${unit})`, color: '#f1f5f9' }
      },
      scales: {
        y: {
          reverse: true,
          ticks: { color: '#94a3b8', callback: (v) => `${v}${unit}` },
          grid: { color: '#1e293b' }
        },
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
      }
    }
  });

  // Draw the offscreen chart onto our main canvas
  ctx.drawImage(offscreen, x, y, w, h);

  chart.destroy();
  document.body.removeChild(offscreen);
}
