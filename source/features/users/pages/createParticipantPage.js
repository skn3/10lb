import { Utils } from '../../../shared/utils/utils.js';
import { SubmitButton } from '../../../shared/components/submitButton.js';
import { UsersService } from '../classes/usersService.js';

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
