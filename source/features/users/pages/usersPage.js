import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { DataTable } from '../../../shared/components/dataTable.js';
import { SubmissionService } from '../../submission/classes/submissionService.js';
import { UsersService } from '../classes/usersService.js';

// =============================================================================
// USERS PAGE — Admin user list with filtering, sorting, bulk actions
// =============================================================================
export function renderUsersPage(app) {
  if (!app.isAdmin()) return app._renderDenied();
  const f = app.state.userFilters || {};
  const users = app.state.users.map((u) => {
    const stats = SubmissionService.userStats(u, app.state.rounds, app.state.submissions, app.state.users);
    return {
      kind: 'user',
      id: u.id,
      user: u,
      role: UsersService.roleLabel(u),
      invited: !!u.invitedAt && !u.inviteAcceptedAt,
      confirmed: !u.invitedAt || !!u.inviteAcceptedAt,
      inCurrentRound: stats.inCurrentRound,
      roundsParticipated: stats.roundsParticipated,
      totalCashWon: stats.totalCashWon,
      totalWeightDelta: stats.totalWeightDelta,
      joinedAt: u.inviteAcceptedAt || u.createdAt || null,
      accessedAt: u.lastLoginAt || null
    };
  });
  const pendingInviteRows = app.isFirebaseMode()
    ? app.state.invites.filter((i) => !i.usedAt).map((inv) => ({
      kind: 'invite',
      id: `invite:${inv.id}`,
      inviteId: inv.id,
      invite: inv,
      role: inv.inviteType === 'admin' ? 'Admin Invite' : 'Invite',
      invited: true,
      confirmed: false,
      inCurrentRound: false,
      roundsParticipated: 0,
      totalCashWon: 0,
      totalWeightDelta: 0,
      joinedAt: null,
      accessedAt: null
    }))
    : [];
  const merged = [...users, ...pendingInviteRows];

  const shown = merged.filter((row) => {
    const type = row.kind === 'invite' ? 'invite' : (row.user.userType || (row.user.isMaster ? 'master' : (row.user.isAdmin ? 'admin' : 'user')));
    if (f.type && f.type !== 'all' && type !== f.type) return false;
    if (f.status === 'invited' && !row.invited) return false;
    if (f.status === 'confirmed' && !row.confirmed) return false;
    if (f.currentChallengeOnly && !row.inCurrentRound) return false;
    if (f.search) {
      const t = f.search.toLowerCase();
      const text = row.kind === 'invite'
        ? `${row.invite.code} ${row.role}`
        : `${Utils.fullName(row.user)} ${row.user.username} ${row.role}`;
      if (!text.toLowerCase().includes(t)) return false;
    }
    if (!app.isFirebaseMode() && row.kind === 'invite') return false;
    return true;
  });

  const sortKey = f.sort || 'a-z';
  shown.sort((a, b) => {
    const dir = sortKey.endsWith('-desc') ? -1 : 1;
    const byText = (x, y) => String(x || '').localeCompare(String(y || ''), undefined, { sensitivity: 'base' }) * dir;
    if (sortKey.startsWith('a-z')) return byText(a.kind === 'invite' ? a.invite.code : Utils.fullName(a.user), b.kind === 'invite' ? b.invite.code : Utils.fullName(b.user));
    if (sortKey.startsWith('type')) return byText(a.role, b.role);
    if (sortKey.startsWith('joined')) return (new Date(a.joinedAt || a.invite?.createdAt || 0).getTime() - new Date(b.joinedAt || b.invite?.createdAt || 0).getTime()) * dir;
    if (sortKey.startsWith('last')) return (new Date(a.accessedAt || 0).getTime() - new Date(b.accessedAt || 0).getTime()) * dir;
    if (sortKey.startsWith('weight')) return (a.totalWeightDelta - b.totalWeightDelta) * dir;
    if (sortKey.startsWith('money')) return (a.totalCashWon - b.totalCashWon) * dir;
    return 0;
  });

  const tableHeaders = ['', 'User', 'Type', 'Last logged in', ...(app.isFirebaseMode() ? ['Active sessions'] : []), 'Rounds participated', 'Total cash won', 'Total weight lost/gained', 'In current round', 'Actions'];
  const tableRows = shown.map((row) => {
    if (row.kind === 'invite') {
      return [
        '',
        `Invite<div class="small muted"><code>${Utils.esc(row.invite.code)}</code></div>`,
        row.role,
        '—',
        ...(app.isFirebaseMode() ? ['—'] : []),
        '0',
        Utils.money(0, app.state.appSettings.currency),
        `0${app.state.appSettings.weightFormat}`,
        'No',
        `<div class="row"><select data-user-action-select="${Utils.escAttr(row.id)}"><option value="">Actions…</option><option value="view-invite">View invite</option><option value="delete-invite">Delete invite</option></select>${SubmitButton.render({ text: 'Apply', icon: 'task_alt', theme: 'secondary small', attrs: { 'data-user-action-apply': row.id } })}</div>`
      ];
    }
    const u = row.user;
    const activeSessions = app.isFirebaseMode() ? app.state.sessions.filter((s) => s?.userId === u.id).length : 0;
    return [
      `<input type="checkbox" data-bulk-user="${u.id}" ${app.state.selectedUsers.includes(u.id) ? 'checked' : ''} ${u.isMaster ? 'disabled' : ''}/>`,
      `${Utils.esc(Utils.fullName(u))}<div class="small muted">${Utils.esc(UsersService.userLoginLabel(u))}${row.invited ? ' • invited' : ''}</div>`,
      row.role,
      Utils.timeAgo(u.lastLoginAt),
      ...(app.isFirebaseMode() ? [String(activeSessions)] : []),
      String(row.roundsParticipated),
      Utils.money(row.totalCashWon, app.state.appSettings.currency),
      `${row.totalWeightDelta}${app.state.appSettings.weightFormat}`,
      row.inCurrentRound ? 'Yes' : 'No',
      SubmitButton.render({ text: 'Open', icon: 'person', theme: 'secondary small', attrs: { 'type': 'button', 'data-manage-user': u.id } })
    ];
  });

  return `<div class="card"><div class="row between"><h2 style="margin:0">Users</h2><div class="row">${SubmitButton.render({ text: 'Create participant', icon: 'person_add', attrs: { 'type': 'button', 'data-go': 'create_participant' } })}${app.isFirebaseMode() ? SubmitButton.render({ text: 'Create invite', icon: 'add_link', id: 'btn-create-invite' }) : ''}${SubmitButton.render({ text: 'Delete selected', icon: 'delete_sweep', theme: 'danger', attrs: { 'data-bulk-delete': '1' } })}</div></div>
    <div class="grid three" style="margin-top:8px">
      <div><label>Type</label><select id="users-filter-type"><option value="all" ${f.type === 'all' ? 'selected' : ''}>All</option><option value="master" ${f.type === 'master' ? 'selected' : ''}>Master</option><option value="admin" ${f.type === 'admin' ? 'selected' : ''}>Admin</option><option value="user" ${f.type === 'user' ? 'selected' : ''}>User</option><option value="participant" ${f.type === 'participant' ? 'selected' : ''}>Participant</option>${app.isFirebaseMode() ? `<option value="invite" ${f.type === 'invite' ? 'selected' : ''}>Invite</option>` : ''}</select></div>
      <div><label>Status</label><select id="users-filter-status"><option value="all" ${f.status === 'all' ? 'selected' : ''}>All</option><option value="confirmed" ${f.status === 'confirmed' ? 'selected' : ''}>Confirmed</option><option value="invited" ${f.status === 'invited' ? 'selected' : ''}>Invited</option></select></div>
      <div><label>Sort</label><select id="users-filter-sort"><option value="a-z" ${f.sort === 'a-z' ? 'selected' : ''}>A-Z</option><option value="a-z-desc" ${f.sort === 'a-z-desc' ? 'selected' : ''}>Z-A</option><option value="type-a-z" ${f.sort === 'type-a-z' ? 'selected' : ''}>Type, A-Z</option><option value="type-a-z-desc" ${f.sort === 'type-a-z-desc' ? 'selected' : ''}>Type, Z-A</option><option value="joined-a-z" ${f.sort === 'joined-a-z' ? 'selected' : ''}>Joined/Invited, Oldest-Newest</option><option value="joined-a-z-desc" ${f.sort === 'joined-a-z-desc' ? 'selected' : ''}>Joined/Invited, Newest-Oldest</option><option value="last-a-z" ${f.sort === 'last-a-z' ? 'selected' : ''}>Last accessed, Oldest-Newest</option><option value="last-a-z-desc" ${f.sort === 'last-a-z-desc' ? 'selected' : ''}>Last accessed, Newest-Oldest</option><option value="weight-a-z" ${f.sort === 'weight-a-z' ? 'selected' : ''}>Total weight lost, Low-High</option><option value="weight-a-z-desc" ${f.sort === 'weight-a-z-desc' ? 'selected' : ''}>Total weight lost, High-Low</option><option value="money-a-z" ${f.sort === 'money-a-z' ? 'selected' : ''}>Total money won, Low-High</option><option value="money-a-z-desc" ${f.sort === 'money-a-z-desc' ? 'selected' : ''}>Total money won, High-Low</option></select></div>
      <div><label>Search</label><input id="users-filter-search" value="${Utils.escAttr(f.search || '')}" placeholder="Search users…" /></div>
      <div><label class="row"><input type="checkbox" id="users-filter-current" style="width:auto" ${f.currentChallengeOnly ? 'checked' : ''}/> Only users in current challenge</label></div>
    </div>
    <div style="overflow:auto;margin-top:8px">
      ${DataTable.render({ headers: tableHeaders, rows: tableRows, emptyMessage: 'No users found.', colSpan: tableHeaders.length })}
    </div>
  </div>`;
}

export function bindUsersPageEvents(app) {
  document.querySelectorAll('[data-manage-user]').forEach((button) => button.onclick = () => {
    app.navigate('user', { userId: button.dataset.manageUser });
  });

  const bulkCheckboxes = document.querySelectorAll('[data-bulk-user]');
  bulkCheckboxes.forEach((x) => x.onchange = () => {
    const id = x.dataset.bulkUser;
    if (x.checked) app.state.selectedUsers = [...new Set([...app.state.selectedUsers, id])];
    else app.state.selectedUsers = app.state.selectedUsers.filter((v) => v !== id);
  });

  const setUserFilter = (key, value) => {
    app.state.userFilters = { ...app.state.userFilters, [key]: value };
    app.render();
  };
  const filterType = document.getElementById('users-filter-type');
  if (filterType) filterType.onchange = () => setUserFilter('type', filterType.value);
  const filterStatus = document.getElementById('users-filter-status');
  if (filterStatus) filterStatus.onchange = () => setUserFilter('status', filterStatus.value);
  const filterSort = document.getElementById('users-filter-sort');
  if (filterSort) filterSort.onchange = () => setUserFilter('sort', filterSort.value);
  const filterSearch = document.getElementById('users-filter-search');
  if (filterSearch) filterSearch.oninput = () => setUserFilter('search', filterSearch.value.trim());
  const filterCurrent = document.getElementById('users-filter-current');
  if (filterCurrent) filterCurrent.onchange = () => setUserFilter('currentChallengeOnly', !!filterCurrent.checked);

  document.querySelectorAll('[data-user-action-apply]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.userActionApply;
    const select = document.querySelector(`[data-user-action-select="${CSS.escape(id)}"]`);
    const action = select?.value || '';
    if (!action) return;
    if (!id.startsWith('invite:')) return;
    const inviteId = id.split(':')[1];
    const inv = app.state.invites.find((x) => x.id === inviteId);
    if (!inv) return;
    if (action === 'view-invite') {
      app.state.inviteDetail = inv;
      app.navigate('invite-detail');
      return;
    }
    if (action === 'delete-invite') {
      if (!confirm('Delete this invite?')) return;
      const { InvitesService } = await import('../../invites/classes/invitesService.js');
      await InvitesService.deleteInvite(inv.id);
      await app.refresh();
      app.setMessage('Invite deleted.');
      return app.render();
    }
  });

  const bulkDelete = document.querySelector('[data-bulk-delete="1"]');
  if (bulkDelete) bulkDelete.onclick = async () => {
    const ids = app.state.selectedUsers.filter((id) => {
      const u = app.state.users.find((x) => x.id === id);
      return u && !u.isMaster && u.id !== app.state.currentUser.id;
    });
    if (!ids.length) return app.fail('Select users to delete.');
    if (!confirm(`Delete ${ids.length} selected user(s)? This cannot be undone.`)) return;
    for (const id of ids) await UsersService.deleteUser(id);
    app.state.selectedUsers = [];
    await app.refresh();
    app.setMessage('Selected users deleted.');
    app.render();
  };
}
