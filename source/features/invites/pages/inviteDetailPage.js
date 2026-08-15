import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { InviteQRCode } from '../components/qrCode.js';
import { InvitesService } from '../classes/invitesService.js';
import { generateInviteCode } from '../utils/inviteCodeUtils.js';
import { DeniedPage } from '../../app/pages/deniedPage.js';

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

const React = window.React;

export function InviteDetailPage({ app }) {
  const e = React.createElement;
  const qrContainerRef = React.useRef(null);
  const linkInputRef = React.useRef(null);
  const copyBtnRef = React.useRef(null);

  if (!app.isAdmin()) return e(DeniedPage, { app });

  const inv = app.state.inviteDetail;
  if (!inv) return e('div', { className: 'card' }, e('p', { className: 'muted' }, 'No invite selected.'));

  const inviteLink = app.routeLink('join', { inviteCode: inv.code });

  React.useEffect(() => {
    if (qrContainerRef.current) InviteQRCode.attach(inviteLink, qrContainerRef.current);
  }, [inviteLink]);

  const handleCopyLink = async () => {
    const input = linkInputRef.current;
    const btn = copyBtnRef.current;
    if (!input) return;
    try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand('copy'); }
    if (btn) { const span = btn.querySelector('span + *') || btn.lastChild; if (span && span.nodeType === 3) btn.replaceChild(document.createTextNode(' Copied!'), span); btn.title = 'Copied!'; setTimeout(() => { if (span && span.nodeType === 3) btn.replaceChild(document.createTextNode(' Copy link'), span); }, 2000); }
  };

  const handleCreateNew = async () => {
    const code = generateInviteCode();
    const invite = { id: code, code, inviteType: 'user', createdAt: new Date().toISOString(), usedAt: null, usedBy: null };
    await InvitesService.createInvite(invite);
    await app.refresh();
    app.state.inviteDetail = invite;
    app.navigate('invite-detail');
  };

  const handleDelete = async () => {
    if (!confirm('Delete this invite?')) return;
    await InvitesService.deleteInvite(inv.id);
    await app.refresh();
    app.state.inviteDetail = null;
    app.navigate('users', { keepFlash: true, replace: true });
    app.setMessage('Invite deleted.');
  };

  return e('div', { className: 'card', style: { maxWidth: '640px', margin: '0 auto' } },
    e('div', { className: 'row between', style: { marginBottom: '12px' } },
      e('h2', { style: { margin: 0 } }, 'Invite link'),
      e('button', { type: 'button', className: 'btn secondary', onClick: () => app.navigate('users') }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'arrow_back'), ' Back to users')
    ),
    e('p', { className: 'muted' }, 'Share this invite with the person you want to join. The code can only be used once.'),
    e('div', { ref: qrContainerRef, style: { textAlign: 'center', margin: '16px 0' } }),
    e('div', { style: { margin: '16px 0' } },
      e('label', null, 'Invite code'),
      e('div', { className: 'row' },
        e('code', { style: { fontSize: '1.6rem', letterSpacing: '.2em', fontWeight: '700', background: 'var(--bg)', padding: '10px 16px', borderRadius: '10px', flex: '1', textAlign: 'center' } }, inv.code)
      )
    ),
    e('div', { style: { margin: '16px 0' } },
      e('label', null, 'Invite link'),
      e('div', { className: 'row' },
        e('input', { ref: linkInputRef, readOnly: true, defaultValue: inviteLink, style: { fontSize: '.85rem' } }),
        e('button', { ref: copyBtnRef, type: 'button', className: 'btn', style: { whiteSpace: 'nowrap' }, onClick: handleCopyLink },
          e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'content_copy'), ' Copy link')
      )
    ),
    e('div', { className: 'row', style: { marginTop: '16px' } },
      e('button', { type: 'button', className: 'btn secondary', onClick: handleCreateNew }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'add_link'), ' Create another invite'),
      e('button', { type: 'button', className: 'btn danger', onClick: handleDelete }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'delete'), ' Delete this invite')
    ),
    e('p', { className: 'small muted', style: { marginTop: '8px' } }, `Issued: ${Utils.dateTime(inv.createdAt)}`)
  );
}
