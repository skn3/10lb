import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { InvitesService } from '../classes/invitesService.js';
import { generateInviteCode } from '../utils/inviteCodeUtils.js';

// =============================================================================
// INVITES PAGE — Admin list of pending and used invites
// =============================================================================
export function renderInvitesPage(app) {
  if (!app.isAdmin()) return app._renderDenied();
  const pending = app.state.invites.filter((i) => !i.usedAt);
  const used = app.state.invites.filter((i) => !!i.usedAt);
  const pendingRows = pending.map((inv) => `<tr>
    <td><code style="font-size:.9rem;letter-spacing:.1em">${Utils.esc(inv.code)}</code></td>
    <td>${Utils.dateTime(inv.createdAt)}</td>
    <td><span class="pill warn">Pending</span></td>
    <td>
      <div class="row">
        ${SubmitButton.render({ text: 'View', icon: 'visibility', theme: 'secondary small', attrs: { 'data-view-invite': inv.id } })}
        ${SubmitButton.render({ text: 'Delete', icon: 'delete', theme: 'danger small', attrs: { 'data-delete-invite': inv.id } })}
      </div>
    </td>
  </tr>`).join('');
  const usedRows = used.map((inv) => {
    const user = app.state.users.find((u) => u.id === inv.usedBy);
    return `<tr>
      <td><code style="font-size:.9rem;letter-spacing:.1em">${Utils.esc(inv.code)}</code></td>
      <td>${Utils.dateTime(inv.createdAt)}</td>
      <td><span class="pill ok">Used</span></td>
      <td>${user ? Utils.esc(Utils.fullName(user)) : '<span class="muted">Unknown</span>'}</td>
      <td>${Utils.dateTime(inv.usedAt)}</td>
      <td>${SubmitButton.render({ text: 'Delete', icon: 'delete', theme: 'danger small', attrs: { 'data-delete-invite': inv.id } })}</td>
    </tr>`;
  }).join('');
  return `<div class="card">
    <div class="row between" style="margin-bottom:12px">
      <h2 style="margin:0">Invites</h2>
      <div class="row">
        ${SubmitButton.render({ text: 'Create invite', icon: 'person_add', id: 'btn-create-invite' })}
        ${pending.length ? SubmitButton.render({ text: 'Delete all pending', icon: 'delete_sweep', theme: 'danger', id: 'btn-delete-all-invites' }) : ''}
      </div>
    </div>
    <h3 style="margin-top:0">Pending (${pending.length})</h3>
    ${pending.length ? `<div style="overflow:auto"><table class="table"><thead><tr><th>Code</th><th>Issued</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${pendingRows}</tbody></table></div>` : `<p class="muted">No pending invites. Create one to invite someone.</p>`}
    ${used.length ? `<h3 style="margin-top:16px">Used (${used.length})</h3>
      <div style="overflow:auto"><table class="table"><thead><tr><th>Code</th><th>Issued</th><th>Status</th><th>Used by</th><th>Used at</th><th>Actions</th></tr></thead>
      <tbody>${usedRows}</tbody></table></div>` : ''}
  </div>`;
}

export function bindInvitesPageEvents(app) {
  const btnCreateInvite = document.getElementById('btn-create-invite');
  if (btnCreateInvite) btnCreateInvite.onclick = async () => {
    const code = generateInviteCode();
    const invite = { id: code, code, inviteType: 'user', createdAt: new Date().toISOString(), usedAt: null, usedBy: null };
    await InvitesService.createInvite(invite);
    await app.refresh();
    app.state.inviteDetail = invite;
    app.navigate('invite-detail');
  };

  const btnDeleteAllInvites = document.getElementById('btn-delete-all-invites');
  if (btnDeleteAllInvites) btnDeleteAllInvites.onclick = async () => {
    if (!confirm('Delete all pending invites? This cannot be undone.')) return;
    await InvitesService.deleteAllPendingInvites(app.state.invites);
    await app.refresh();
    app.setMessage('All pending invites deleted.');
    app.render();
  };

  document.querySelectorAll('[data-view-invite]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.viewInvite;
    const inv = app.state.invites.find((i) => i.id === id);
    if (!inv) return;
    app.state.inviteDetail = inv;
    app.navigate('invite-detail');
  });

  document.querySelectorAll('[data-delete-invite]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.deleteInvite;
    if (!confirm('Delete this invite?')) return;
    await InvitesService.deleteInvite(id);
    await app.refresh();
    if (app.state.inviteDetail?.id === id) {
      app.state.inviteDetail = null;
      app.navigate('users', { keepFlash: true, replace: true });
      return;
    }
    app.setMessage('Invite deleted.');
    app.render();
  });
}
