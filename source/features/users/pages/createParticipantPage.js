import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { UsersService } from '../classes/usersService.js';
import { DeniedPage } from '../../app/pages/deniedPage.js';

const React = window.React;

// =============================================================================
// CREATE PARTICIPANT PAGE
// =============================================================================
export function renderCreateParticipantPage(app) {
  if (!app.isAdmin()) return app._renderDenied();
  return `<div class="card" style="max-width:640px;margin:0 auto">
    <div class="row between" style="margin-bottom:12px">
      <h2 style="margin:0">Create participant</h2>
      ${SubmitButton.render({ text: 'Back to users', icon: 'arrow_back', theme: 'secondary', attrs: { 'type': 'button', 'data-go': 'users' } })}
    </div>
    <p class="muted">Create a participant with only a name so an admin can submit challenge weights for them.</p>
    <form id="create-participant-form" class="grid">
      <div><label>Participant name</label><input name="fullName" type="text" required autocomplete="name" placeholder="e.g. Jane Smith" /></div>
      <div class="small muted">Participants cannot log in until you promote or invite them later.</div>
      <div class="row">${SubmitButton.render({ text: 'Create participant', icon: 'person_add', submit: true })}${SubmitButton.render({ text: 'Cancel', icon: 'close', theme: 'secondary', attrs: { 'type': 'button', 'data-go': 'users' } })}</div>
    </form>
  </div>`;
}

export function bindCreateParticipantEvents(app) {
  const createParticipantForm = document.getElementById('create-participant-form');
  if (!createParticipantForm) return;
  app.bindAsyncFormSubmit(createParticipantForm, async () => {
    const fullName = createParticipantForm.fullName.value.trim().replace(/\s+/g, ' ');
    if (!fullName) return app.fail('Enter a participant name.');
    const exists = app.state.users.find((user) => Utils.fullName(user).toLowerCase() === fullName.toLowerCase());
    if (exists) return app.fail('A user with that name already exists.');
    const parsed = Utils.parseName(fullName);
    const participant = await UsersService.createUser({
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      userType: 'participant',
      isAdmin: false,
      isMaster: false,
      canLogin: false
    });
    await app.refresh();
    app.setMessage('Participant created.');
    app.navigate('user', { userId: participant.id, keepFlash: true });
  });
}

export function CreateParticipantPage({ app }) {
  const e = React.createElement;
  const formRef = React.useRef(null);

  if (!app.isAdmin()) return e(DeniedPage, { app });

  React.useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    app.bindAsyncFormSubmit(form, async () => {
      const fullName = form.fullName.value.trim().replace(/\s+/g, ' ');
      if (!fullName) return app.fail('Enter a participant name.');
      const exists = app.state.users.find((user) => Utils.fullName(user).toLowerCase() === fullName.toLowerCase());
      if (exists) return app.fail('A user with that name already exists.');
      const parsed = Utils.parseName(fullName);
      const participant = await UsersService.createUser({
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        userType: 'participant',
        isAdmin: false,
        isMaster: false,
        canLogin: false
      });
      await app.refresh();
      app.setMessage('Participant created.');
      app.navigate('user', { userId: participant.id, keepFlash: true });
    });
  });

  return e('div', { className: 'card', style: { maxWidth: '640px', margin: '0 auto' } },
    e('div', { className: 'row between', style: { marginBottom: '12px' } },
      e('h2', { style: { margin: 0 } }, 'Create participant'),
      e('button', { type: 'button', className: 'btn secondary', onClick: () => app.navigate('users') },
        e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'arrow_back'), ' Back to users')
    ),
    e('p', { className: 'muted' }, 'Create a participant with only a name so an admin can submit challenge weights for them.'),
    e('form', { ref: formRef, action: '#', className: 'grid' },
      e('div', null,
        e('label', null, 'Participant name'),
        e('input', { name: 'fullName', type: 'text', required: true, autoComplete: 'name', placeholder: 'e.g. Jane Smith' })
      ),
      e('div', { className: 'small muted' }, 'Participants cannot log in until you promote or invite them later.'),
      e('div', { className: 'row' },
        e('button', { type: 'submit', className: 'btn' }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'person_add'), ' Create participant'),
        e('button', { type: 'button', className: 'btn secondary', onClick: () => app.navigate('users') }, e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'close'), ' Cancel')
      )
    )
  );
}

