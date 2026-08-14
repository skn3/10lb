import { UserType, UserTypeIcon } from '../../../constants.js';
import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { DataTable } from '../components/dataTable.js';
import { SubmissionService } from '../../submission/classes/submissionService.js';
import { UsersService } from '../classes/usersService.js';

// =============================================================================
// USERS PAGE — Admin user list with filtering, sorting, bulk actions
// =============================================================================
function resolveRowType(row) {
  if (row.kind === 'invite') return 'invite';
  return row.user.userType || (row.user.isMaster ? UserType.MASTER : (row.user.isAdmin ? UserType.ADMIN : UserType.USER));
}

function isProtectedUser(app, user) {
  return !!user && (user.isMaster || user.id === app.state.currentUser?.id);
}

function selectedDeletableUserIds(app) {
  return app.state.selectedUsers.filter((id) => {
    const user = app.state.users.find((entry) => entry.id === id);
    return user && !isProtectedUser(app, user);
  });
}

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
  const deletableSelectedIds = selectedDeletableUserIds(app);
  const selectedCount = deletableSelectedIds.length;

  const shown = merged.filter((row) => {
    const type = resolveRowType(row);
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

  const tableHeaders = ['', 'User', 'Type', 'Last logged in', ...(app.isFirebaseMode() ? ['Active sessions'] : []), 'Rounds participated', 'Total cash won', 'Total weight lost/gained', 'In current round'];
  const tableRows = shown.map((row) => {
    if (row.kind === 'invite') {
    return `<tr class="is-clickable" tabindex="0" role="button" data-open-invite="${Utils.escAttr(row.inviteId)}">` +
      `<td></td>` +
      `<td><span class="user-linkish"><span class="material-symbols-rounded" aria-hidden="true">${Utils.esc(UserTypeIcon.invite)}</span><span>Invite</span></span><div class="small muted"><code>${Utils.esc(row.invite.code)}</code></div></td>` +
      `<td>${row.role}</td>` +
      `<td>—</td>` +
      `${app.isFirebaseMode() ? '<td>—</td>' : ''}` +
      `<td>0</td>` +
      `<td>${Utils.money(0, app.state.appSettings.currency)}</td>` +
      `<td>0${app.state.appSettings.weightFormat}</td>` +
      `<td>No</td>` +
    `</tr>`;
    }
    const u = row.user;
    const protectedUser = isProtectedUser(app, u);
    const activeSessions = app.isFirebaseMode() ? app.state.sessions.filter((s) => s?.userId === u.id).length : 0;
    const icon = UserTypeIcon[resolveRowType(row)] || UserTypeIcon[UserType.USER];
    return `<tr class="is-clickable" tabindex="0" role="button" data-open-user="${Utils.escAttr(u.id)}">` +
    `<td><input type="checkbox" data-bulk-user="${Utils.escAttr(u.id)}" ${deletableSelectedIds.includes(u.id) ? 'checked' : ''} ${protectedUser ? 'disabled' : ''}/></td>` +
    `<td><span class="user-linkish"><span class="material-symbols-rounded" aria-hidden="true">${Utils.esc(icon)}</span><span>${Utils.esc(Utils.fullName(u))}</span></span><div class="small muted">${Utils.esc(UsersService.userLoginLabel(u))}${row.invited ? ' • invited' : ''}</div></td>` +
    `<td>${row.role}</td>` +
    `<td>${Utils.timeAgo(u.lastLoginAt)}</td>` +
    `${app.isFirebaseMode() ? `<td>${activeSessions}</td>` : ''}` +
    `<td>${row.roundsParticipated}</td>` +
    `<td>${Utils.money(row.totalCashWon, app.state.appSettings.currency)}</td>` +
    `<td>${row.totalWeightDelta}${app.state.appSettings.weightFormat}</td>` +
    `<td>${row.inCurrentRound ? 'Yes' : 'No'}</td>` +
    `</tr>`;
  });

  return `<div class="card"><div class="row between"><h2 style="margin:0">User filters</h2><span class="small muted">${shown.length} shown</span></div>
    <div class="grid two" style="margin-top:8px">
      <div><label>Type</label><select id="users-filter-type"><option value="all" ${f.type === 'all' ? 'selected' : ''}>All</option><option value="master" ${f.type === 'master' ? 'selected' : ''}>Master</option><option value="admin" ${f.type === 'admin' ? 'selected' : ''}>Admin</option><option value="user" ${f.type === 'user' ? 'selected' : ''}>User</option><option value="participant" ${f.type === 'participant' ? 'selected' : ''}>Participant</option>${app.isFirebaseMode() ? `<option value="invite" ${f.type === 'invite' ? 'selected' : ''}>Invite</option>` : ''}</select></div>
      <div><label>Status</label><select id="users-filter-status"><option value="all" ${f.status === 'all' ? 'selected' : ''}>All</option><option value="confirmed" ${f.status === 'confirmed' ? 'selected' : ''}>Confirmed</option><option value="invited" ${f.status === 'invited' ? 'selected' : ''}>Invited</option></select></div>
      <div><label>Sort</label><select id="users-filter-sort"><option value="a-z" ${f.sort === 'a-z' ? 'selected' : ''}>A-Z</option><option value="a-z-desc" ${f.sort === 'a-z-desc' ? 'selected' : ''}>Z-A</option><option value="type-a-z" ${f.sort === 'type-a-z' ? 'selected' : ''}>Type, A-Z</option><option value="type-a-z-desc" ${f.sort === 'type-a-z-desc' ? 'selected' : ''}>Type, Z-A</option><option value="joined-a-z" ${f.sort === 'joined-a-z' ? 'selected' : ''}>Joined/Invited, Oldest-Newest</option><option value="joined-a-z-desc" ${f.sort === 'joined-a-z-desc' ? 'selected' : ''}>Joined/Invited, Newest-Oldest</option><option value="last-a-z" ${f.sort === 'last-a-z' ? 'selected' : ''}>Last accessed, Oldest-Newest</option><option value="last-a-z-desc" ${f.sort === 'last-a-z-desc' ? 'selected' : ''}>Last accessed, Newest-Oldest</option><option value="weight-a-z" ${f.sort === 'weight-a-z' ? 'selected' : ''}>Total weight lost, Low-High</option><option value="weight-a-z-desc" ${f.sort === 'weight-a-z-desc' ? 'selected' : ''}>Total weight lost, High-Low</option><option value="money-a-z" ${f.sort === 'money-a-z' ? 'selected' : ''}>Total money won, Low-High</option><option value="money-a-z-desc" ${f.sort === 'money-a-z-desc' ? 'selected' : ''}>Total money won, High-Low</option></select></div>
      <div><label>Search</label><input id="users-filter-search" value="${Utils.escAttr(f.search || '')}" placeholder="Search users…" /></div>
      <div><label class="row"><input type="checkbox" id="users-filter-current" style="width:auto" ${f.currentChallengeOnly ? 'checked' : ''}/> Only users in current challenge</label></div>
    </div>
  </div>
  <div class="card"><div class="row between"><h2 style="margin:0">Users</h2><div class="row">${SubmitButton.render({ text: 'Create participant', icon: 'person_add', attrs: { 'type': 'button', 'data-go': 'create_participant' } })}${app.isFirebaseMode() ? SubmitButton.render({ text: 'Create invite', icon: 'add_link', id: 'btn-create-invite' }) : ''}</div></div>
    <div class="row between" style="margin-top:12px">
    <span class="selection-status">${selectedCount} selected</span>
    ${SubmitButton.render({ text: 'Delete selected', icon: 'delete_sweep', theme: 'danger', attrs: { 'data-bulk-delete': '1', 'type': 'button', ...(selectedCount ? {} : { disabled: 'disabled' }) } })}
    </div>
    <div style="overflow:auto;margin-top:8px">
    ${DataTable.render({ headers: tableHeaders, rows: tableRows, emptyMessage: 'No users found.', colSpan: tableHeaders.length })}
    </div>
  </div>`;
}

export function bindUsersPageEvents(app) {
  document.querySelectorAll('[data-open-user]').forEach((row) => {
    const open = () => app.navigate('user', { userId: row.dataset.openUser });
    row.onclick = (event) => {
    if (event.target.closest('input,button,select,a,label')) return;
    open();
    };
    row.onkeydown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('input,button,select,a,label')) return;
    event.preventDefault();
    open();
    };
  });

  document.querySelectorAll('[data-open-invite]').forEach((row) => {
    const open = () => {
    const invite = app.state.invites.find((entry) => entry.id === row.dataset.openInvite);
    if (!invite) return;
    app.state.inviteDetail = invite;
    app.navigate('invite-detail');
    };
    row.onclick = (event) => {
    if (event.target.closest('input,button,select,a,label')) return;
    open();
    };
    row.onkeydown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('input,button,select,a,label')) return;
    event.preventDefault();
    open();
    };
  });

  const bulkCheckboxes = document.querySelectorAll('[data-bulk-user]');
  bulkCheckboxes.forEach((x) => {
    x.onclick = (event) => event.stopPropagation();
    x.onchange = () => {
    const id = x.dataset.bulkUser;
    if (x.checked) app.state.selectedUsers = [...new Set([...app.state.selectedUsers, id])];
    else app.state.selectedUsers = app.state.selectedUsers.filter((v) => v !== id);
    app.render();
    };
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

  const bulkDelete = document.querySelector('[data-bulk-delete="1"]');
  if (bulkDelete) bulkDelete.onclick = async () => {
    const ids = selectedDeletableUserIds(app);
    if (!ids.length) return app.fail('Select users to delete.');
    if (!confirm(`Delete ${ids.length} selected user(s)? This cannot be undone.`)) return;
    for (const id of ids) await UsersService.deleteUser(id);
    app.state.selectedUsers = [];
    await app.refresh();
    app.setMessage('Selected users deleted.');
    app.render();
  };
}
