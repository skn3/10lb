import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { Data } from '../../storage/models/data.js';
import { AuthService } from '../../authentication/classes/authService.js';
import { InvitesService } from '../../invites/classes/invitesService.js';

// =============================================================================
// JOIN PAGE — invite-based registration
// =============================================================================
export function renderJoinPage(app) {
  if (!app.isFirebaseMode()) {
    return `<div class="card" style="max-width:560px;margin:0 auto"><h2 style="margin-top:0">Registration unavailable</h2><p class="muted">This server is running in offline mode. Ask the master admin to create participant accounts.</p>${SubmitButton.render({ text: 'Go to login', icon: 'login', theme: 'secondary', id: 'btn-go-login' })}</div>`;
  }
  const code = app.state.pendingInviteCode || '';
  const serverName = app.state.appSettings?.serverName || '10lb Challenge';
  return `<div class="card" style="max-width:560px;margin:0 auto">
    <h2 style="margin-top:0">Join ${Utils.esc(serverName)}</h2>
    <p class="muted">Enter your invite code and create your account.</p>
    <form id="join-form" class="grid">
      <div><label>Invite code</label><input name="inviteCode" type="text" required autocomplete="off" autocapitalize="characters" spellcheck="false" minlength="8" maxlength="8" pattern="[A-HJ-NP-Z2-9]{8}" title="Enter the 8-character invite code." value="${Utils.escAttr(code)}" placeholder="e.g. ABCD1234" style="text-transform:uppercase;letter-spacing:.1em" /></div>
      <div><label>Email</label><input name="username" type="email" required autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" /></div>
      <div><label>Password</label><input name="password" type="password" required ${Utils.passwordInputAttrs('new-password')} /></div>
      <div><label>Confirm password</label><input name="confirmPassword" type="password" required ${Utils.passwordInputAttrs('new-password')} /></div>
      <div><label>First name</label><input name="firstName" type="text" required autocomplete="given-name" /></div>
      <div><label>Last name</label><input name="lastName" type="text" required autocomplete="family-name" /></div>
      <div style="grid-column:1/-1" class="small muted">Password must contain at least 8 characters, including a number, letter, and symbol.</div>
      <div style="grid-column:1/-1" class="row">
        ${SubmitButton.render({ text: 'Create account', icon: 'person_add', submit: true })}
        ${SubmitButton.render({ text: 'Already have an account', icon: 'login', theme: 'secondary', id: 'btn-go-login' })}
      </div>
    </form>
  </div>`;
}

export function bindJoinEvents(app) {
  const btnGoLogin = document.getElementById('btn-go-login');
  if (btnGoLogin) btnGoLogin.onclick = () => { app.navigate('login'); };

  const joinForm = document.getElementById('join-form');
  if (joinForm) {
    app.enhanceFormValidation(joinForm);
    const codeInput = joinForm.querySelector('[name="inviteCode"]');
    if (codeInput) codeInput.oninput = () => { codeInput.value = codeInput.value.toUpperCase(); };

    app.bindAsyncFormSubmit(joinForm, async () => {
      if (!app.isFirebaseMode()) return app.fail('Invites are unavailable in offline mode.');
      const code = joinForm.inviteCode.value.trim().toUpperCase();
      const email = joinForm.username.value.trim();
      const password = joinForm.password.value;
      const confirmPassword = joinForm.confirmPassword.value;
      const firstName = joinForm.firstName.value.trim();
      const lastName = joinForm.lastName.value.trim();

      if (!code) return app.fail('Enter your invite code.');
      if (!email || !firstName || !lastName) return app.fail('Complete all required fields.');
      if (!Utils.validEmail(email)) return app.fail('Enter a valid email address.');
      if (!Utils.validPassword(password)) return app.fail('Password must include 8+ chars, a letter, a number and a symbol.');
      if (password !== confirmPassword) return app.fail('Passwords do not match.');

      const invite = app.isFirebaseMode()
        ? await InvitesService.getFirebaseInvite(code)
        : await Data.adapter.getInviteByCode(code);
      if (!invite) return app.fail('Invite code not found or invalid.');
      if (invite.usedAt) return app.fail('This invite code has already been used.');

      let existsByEmail;
      if (app.isFirebaseMode()) {
        try {
          const remoteMatches = await AuthService.queryUsersByEmail(email);
          existsByEmail = remoteMatches.find((u) => !u.deletedAt) || null;
        } catch (e) {
          console.warn('Could not check email uniqueness via Firestore:', e.message);
          return app.fail('Could not verify email availability. Please check your connection and try again.');
        }
      } else {
        existsByEmail = await Data.adapter.getUserByUsername(email);
      }
      if (existsByEmail) return app.fail('An account with this email already exists.');

      await AuthService.initializeFirebase();
      let fbUser;
      try {
        fbUser = await AuthService.createUserWithEmail(email, password);
      } catch (err) {
        return app.fail(`Account creation failed: ${err.message || err}`);
      }

      const invitedUserId = invite.userId || Utils.id();
      const invitedUser = await Data.adapter.getUserById(invitedUserId);
      const acceptedAt = new Date().toISOString();
      const userPayload = {
        ...(invitedUser || {}),
        id: invitedUserId,
        username: email,
        firstName,
        lastName,
        password: null,
        firebaseUid: fbUser.uid,
        userType: invite.inviteType || 'user',
        isAdmin: invite.inviteType === 'admin',
        isMaster: false,
        inviteCode: code,
        invitedAt: invite.createdAt || new Date().toISOString(),
        inviteAcceptedAt: acceptedAt,
        lastLoginAt: null,
        canLogin: true
      };
      if (invitedUser) {
        const saved = await app._saveWithConflictResolver('User', userPayload, (payload) => Data.adapter.updateUser(payload));
        if (!saved) return app.fail('Could not finish account activation.');
      } else {
        await Data.adapter.createUser(userPayload);
      }
      const user = await Data.adapter.getUserById(invitedUserId);
      if (!user) return app.fail('Could not finish account activation.');

      const localInvite = await Data.adapter.getInviteByCode(code);
      if (!localInvite) await Data.adapter.createInvite(invite);
      await Data.adapter.consumeInvite(code, user.id);
      await InvitesService.saveFirebaseInvite({
        ...invite,
        usedAt: acceptedAt,
        usedBy: user.id,
        usedByFirebaseUid: fbUser.uid,
        inviteAcceptedAt: acceptedAt
      });
      await app.loginAs(user);
      await app.refresh();
      app.state.pendingInviteCode = '';
      app.setMessage(`Welcome, ${Utils.fullName(user)}! Your account has been created.`);
      app.navigate('overview', { keepFlash: true, replace: true });
    });
  }
}
