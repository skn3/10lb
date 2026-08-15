import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { Data } from '../../storage/models/data.js';
import { AuthService } from '../../authentication/classes/authService.js';
import { Security } from '../../../shared/classes/security.js';

const React = window.React;

// =============================================================================
// LOGIN PAGE
// =============================================================================
export function renderLoginPage(app) {
  return `<div class="card" style="max-width:560px;margin:0 auto"><h2 style="margin-top:0">Login</h2>
    <p class="muted">Enter your account details to continue.</p>
    <form id="login-form" class="grid">
      <div><label>Email</label><input name="username" type="email" inputmode="email" required autocomplete="email" autocapitalize="none" spellcheck="false" /></div>
      <div><label>Password</label><input name="password" type="password" required autocomplete="current-password" /></div>
      <input name="redirect" type="hidden" value="${Utils.escAttr(app.state.redirectAfterLogin || 'overview')}" />
      ${SubmitButton.render({ text: 'Login', icon: 'login', submit: true })}
    </form>
    ${app.isFirebaseMode() ? '<p class="small muted" style="margin-top:12px">Have an invite code? <a href="#" id="link-to-join" style="color:var(--brand)">Click here to register</a></p>' : ''}
  </div>`;
}

export function bindLoginEvents(app) {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    app.bindAsyncFormSubmit(loginForm, async () => {
      const username = loginForm.username.value.trim();
      const password = loginForm.password.value;
      const redirect = loginForm.redirect.value || app.state.redirectAfterLogin || 'overview';
      if (!Utils.validEmail(username)) return app.fail('Enter a valid email address.');

      if (app.isFirebaseMode()) {
        await AuthService.initializeFirebase();
        let fbUser;
        try {
          fbUser = await AuthService.signInWithEmail(username, password);
        } catch {
          return app.fail('Invalid email or password.');
        }
        if (!fbUser) return app.fail('Invalid email or password.');
        let user;
        try {
          user = await AuthService.resolveFirebaseUser(fbUser);
        } catch (e) {
          console.warn('Could not resolve user account after Firebase sign-in:', e.message);
          return app.fail('Could not load account. Please check your connection and try again.');
        }
        if (!user) return app.fail('No account found for this Firebase user. Please contact the admin.');
        if (user.userType === 'participant' || user.canLogin === false) return app.fail('This account cannot log in.');
        await app.loginAs(user);
        await app.refresh();
        const route = app.redirectToPostLogin(redirect);
        app.setMessage(`Welcome back, ${Utils.fullName(app.state.currentUser)}.`);
        app.navigate(route, { keepFlash: true, replace: true });
        return;
      }

      const user = await Data.adapter.getUserByUsername(username);
      if (!user) return app.fail('Invalid email or password.');
      if (user.userType === 'participant' || user.canLogin === false) return app.fail('This account cannot log in.');

      const ok = await Security.verifyPassword(password, user.password);
      if (!ok) return app.fail('Invalid email or password.');

      await app.loginAs(user);
      await app.refresh();

      const route = app.redirectToPostLogin(redirect);
      app.setMessage(`Welcome back, ${Utils.fullName(app.state.currentUser)}.`);
      app.navigate(route, { keepFlash: true, replace: true });
    });
  }

  const btnGoLogin = document.getElementById('btn-go-login');
  if (btnGoLogin) btnGoLogin.onclick = () => { app.navigate('login'); };

  const linkToJoin = document.getElementById('link-to-join');
  if (linkToJoin) linkToJoin.onclick = (e) => { e.preventDefault(); app.navigate('join'); };
}

export function LoginPage({ app }) {
  const e = React.createElement;
  const formRef = React.useRef(null);

  React.useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    app.bindAsyncFormSubmit(form, async () => {
      const username = form.username.value.trim();
      const password = form.password.value;
      const redirect = app.state.redirectAfterLogin || 'overview';
      if (!Utils.validEmail(username)) return app.fail('Enter a valid email address.');

      if (app.isFirebaseMode()) {
        await AuthService.initializeFirebase();
        let fbUser;
        try { fbUser = await AuthService.signInWithEmail(username, password); } catch { return app.fail('Invalid email or password.'); }
        if (!fbUser) return app.fail('Invalid email or password.');
        let user;
        try { user = await AuthService.resolveFirebaseUser(fbUser); } catch (err) {
          console.warn('Could not resolve user account after Firebase sign-in:', err.message);
          return app.fail('Could not load account. Please check your connection and try again.');
        }
        if (!user) return app.fail('No account found for this Firebase user. Please contact the admin.');
        if (user.userType === 'participant' || user.canLogin === false) return app.fail('This account cannot log in.');
        await app.loginAs(user);
        await app.refresh();
        const route = app.redirectToPostLogin(redirect);
        app.setMessage(`Welcome back, ${Utils.fullName(app.state.currentUser)}.`);
        app.navigate(route, { keepFlash: true, replace: true });
        return;
      }

      const user = await Data.adapter.getUserByUsername(username);
      if (!user) return app.fail('Invalid email or password.');
      if (user.userType === 'participant' || user.canLogin === false) return app.fail('This account cannot log in.');
      const ok = await Security.verifyPassword(password, user.password);
      if (!ok) return app.fail('Invalid email or password.');
      await app.loginAs(user);
      await app.refresh();
      const route = app.redirectToPostLogin(redirect);
      app.setMessage(`Welcome back, ${Utils.fullName(app.state.currentUser)}.`);
      app.navigate(route, { keepFlash: true, replace: true });
    });
  });

  return e('div', { className: 'card', style: { maxWidth: '560px', margin: '0 auto' } },
    e('h2', { style: { marginTop: 0 } }, 'Login'),
    e('p', { className: 'muted' }, 'Enter your account details to continue.'),
    e('form', { ref: formRef, action: '#', className: 'grid' },
      e('div', null, e('label', null, 'Email'), e('input', { name: 'username', type: 'email', inputMode: 'email', required: true, autoComplete: 'email', autoCapitalize: 'none', spellCheck: false })),
      e('div', null, e('label', null, 'Password'), e('input', { name: 'password', type: 'password', required: true, autoComplete: 'current-password' })),
      e('button', { type: 'submit', className: 'btn' }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'login'), ' Login')
    ),
    app.isFirebaseMode()
      ? e('p', { className: 'small muted', style: { marginTop: '12px' } },
        'Have an invite code? ',
        e('a', { href: '#', style: { color: 'var(--brand)' }, onClick: (ev) => { ev.preventDefault(); app.navigate('join'); } }, 'Click here to register')
      )
      : null
  );
}

