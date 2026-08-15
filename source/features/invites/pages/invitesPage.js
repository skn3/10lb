import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { InvitesService } from '../classes/invitesService.js';
import { generateInviteCode } from '../utils/inviteCodeUtils.js';
import { DeniedPage } from '../../app/pages/deniedPage.js';

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

const React = window.React;

export function InvitesPage({ app }) {
  const e = React.createElement;

  if (!app.isAdmin()) return e(DeniedPage, { app });

  const pending = app.state.invites.filter((i) => !i.usedAt);
  const used = app.state.invites.filter((i) => !!i.usedAt);

  const handleCreateInvite = async () => {
    const code = generateInviteCode();
    const invite = { id: code, code, inviteType: 'user', createdAt: new Date().toISOString(), usedAt: null, usedBy: null };
    await InvitesService.createInvite(invite);
    await app.refresh();
    app.state.inviteDetail = invite;
    app.navigate('invite-detail');
  };

  const handleDeleteAll = async () => {
    if (!confirm('Delete all pending invites? This cannot be undone.')) return;
    await InvitesService.deleteAllPendingInvites(app.state.invites);
    await app.refresh();
    app.setMessage('All pending invites deleted.');
  };

  const handleViewInvite = (inv) => {
    app.state.inviteDetail = inv;
    app.navigate('invite-detail');
  };

  const handleDeleteInvite = async (id) => {
    if (!confirm('Delete this invite?')) return;
    await InvitesService.deleteInvite(id);
    await app.refresh();
    if (app.state.inviteDetail?.id === id) {
      app.state.inviteDetail = null;
      app.navigate('users', { keepFlash: true, replace: true });
      return;
    }
    app.setMessage('Invite deleted.');
  };

  const pendingRows = pending.map((inv) =>
    e('tr', { key: inv.id },
      e('td', null, e('code', { style: { fontSize: '.9rem', letterSpacing: '.1em' } }, inv.code)),
      e('td', null, Utils.dateTime(inv.createdAt)),
      e('td', null, e('span', { className: 'pill warn' }, 'Pending')),
      e('td', null,
        e('div', { className: 'row' },
          e('button', { type: 'button', className: 'btn secondary small', onClick: () => handleViewInvite(inv) }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'visibility'), ' View'),
          e('button', { type: 'button', className: 'btn danger small', onClick: () => handleDeleteInvite(inv.id) }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'delete'), ' Delete')
        )
      )
    )
  );

  const usedRows = used.map((inv) => {
    const user = app.state.users.find((u) => u.id === inv.usedBy);
    return e('tr', { key: inv.id },
      e('td', null, e('code', { style: { fontSize: '.9rem', letterSpacing: '.1em' } }, inv.code)),
      e('td', null, Utils.dateTime(inv.createdAt)),
      e('td', null, e('span', { className: 'pill ok' }, 'Used')),
      e('td', null, user ? Utils.fullName(user) : e('span', { className: 'muted' }, 'Unknown')),
      e('td', null, Utils.dateTime(inv.usedAt)),
      e('td', null,
        e('button', { type: 'button', className: 'btn danger small', onClick: () => handleDeleteInvite(inv.id) }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'delete'), ' Delete')
      )
    );
  });

  return e('div', { className: 'card' },
    e('div', { className: 'row between', style: { marginBottom: '12px' } },
      e('h2', { style: { margin: 0 } }, 'Invites'),
      e('div', { className: 'row' },
        e('button', { type: 'button', className: 'btn', onClick: handleCreateInvite }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'person_add'), ' Create invite'),
        pending.length ? e('button', { type: 'button', className: 'btn danger', onClick: handleDeleteAll }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'delete_sweep'), ' Delete all pending') : null
      )
    ),
    e('h3', { style: { marginTop: 0 } }, `Pending (${pending.length})`),
    pending.length
      ? e('div', { style: { overflow: 'auto' } },
        e('table', { className: 'table' },
          e('thead', null, e('tr', null, e('th', null, 'Code'), e('th', null, 'Issued'), e('th', null, 'Status'), e('th', null, 'Actions'))),
          e('tbody', null, ...pendingRows)
        ))
      : e('p', { className: 'muted' }, 'No pending invites. Create one to invite someone.'),
    used.length
      ? e(React.Fragment, null,
        e('h3', { style: { marginTop: '16px' } }, `Used (${used.length})`),
        e('div', { style: { overflow: 'auto' } },
          e('table', { className: 'table' },
            e('thead', null, e('tr', null, e('th', null, 'Code'), e('th', null, 'Issued'), e('th', null, 'Status'), e('th', null, 'Used by'), e('th', null, 'Used at'), e('th', null, 'Actions'))),
            e('tbody', null, ...usedRows)
          ))
      )
      : null
  );
}
