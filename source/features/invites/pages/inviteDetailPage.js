import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { InviteQRCode } from '../components/qrCode.js';
import { InvitesService } from '../classes/invitesService.js';
import { generateInviteCode } from '../utils/inviteCodeUtils.js';

// =============================================================================
// INVITE DETAIL PAGE — View/share/delete a specific invite
// =============================================================================
export function renderInviteDetailPage(app) {
  if (!app.isAdmin()) return app._renderDenied();
  const inv = app.state.inviteDetail;
  if (!inv) return app._renderUsers ? app._renderUsers() : '';
  const inviteLink = app.routeLink('join', { inviteCode: inv.code });
  return `<div class="card" style="max-width:640px;margin:0 auto">
    <div class="row between" style="margin-bottom:12px">
      <h2 style="margin:0">Invite link</h2>
      ${SubmitButton.render({ text: 'Back to users', icon: 'arrow_back', theme: 'secondary', attrs: { 'data-go': 'users' } })}
    </div>
    <p class="muted">Share this invite with the person you want to join. The code can only be used once.</p>

    <div style="text-align:center;margin:16px 0">
      ${InviteQRCode.renderPlaceholder()}
    </div>

    <div style="margin:16px 0">
      <label>Invite code</label>
      <div class="row">
        <code id="invite-code-display" style="font-size:1.6rem;letter-spacing:.2em;font-weight:700;background:var(--bg);padding:10px 16px;border-radius:10px;flex:1;text-align:center">${Utils.esc(inv.code)}</code>
      </div>
    </div>

    <div style="margin:16px 0">
      <label>Invite link</label>
      <div class="row">
        <input id="invite-link-input" readonly value="${Utils.escAttr(inviteLink)}" style="font-size:.85rem" />
        ${SubmitButton.render({ text: 'Copy link', icon: 'content_copy', id: 'btn-copy-invite-link', attrs: { style: 'white-space:nowrap' } })}
      </div>
    </div>

    <div class="row" style="margin-top:16px">
      ${SubmitButton.render({ text: 'Create another invite', icon: 'add_link', theme: 'secondary', id: 'btn-create-new-invite' })}
      ${SubmitButton.render({ text: 'Delete this invite', icon: 'delete', theme: 'danger', id: 'btn-delete-this-invite', attrs: { 'data-delete-invite': inv.id } })}
    </div>
    <p class="small muted" style="margin-top:8px">Issued: ${Utils.dateTime(inv.createdAt)}</p>
  </div>`;
}

export function bindInviteDetailEvents(app) {
  // Auto-render QR code when invite-detail is shown
  if (app.state.route === 'invite-detail' && app.state.inviteDetail) {
    const inviteLink = app.routeLink('join', { inviteCode: app.state.inviteDetail.code });
    InviteQRCode.attach(inviteLink);
  }

  const btnCopyLink = document.getElementById('btn-copy-invite-link');
  if (btnCopyLink) btnCopyLink.onclick = async () => {
    const input = document.getElementById('invite-link-input');
    if (!input) return;
    try {
      await navigator.clipboard.writeText(input.value);
      app.setButtonLabel(btnCopyLink, 'Copied!');
      setTimeout(() => { app.setButtonLabel(btnCopyLink, 'Copy link'); }, 2000);
    } catch {
      input.select();
      document.execCommand('copy');
      app.setButtonLabel(btnCopyLink, 'Copied!');
      setTimeout(() => { app.setButtonLabel(btnCopyLink, 'Copy link'); }, 2000);
    }
  };

  const btnCreateNewInvite = document.getElementById('btn-create-new-invite');
  if (btnCreateNewInvite) btnCreateNewInvite.onclick = async () => {
    const code = generateInviteCode();
    const invite = { id: code, code, inviteType: 'user', createdAt: new Date().toISOString(), usedAt: null, usedBy: null };
    await InvitesService.createInvite(invite);
    await app.refresh();
    app.state.inviteDetail = invite;
    app.render();
  };

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
