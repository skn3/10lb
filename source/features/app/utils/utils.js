// =============================================================================
// APP UTILS — form validation helpers and button helpers
// These functions are used by the App object (appController.js) for
// UI-level form enhancement and button state management.
// =============================================================================

/**
 * Apply HTML5 custom validity messages to all required fields in a form.
 * Must be called before checkValidity() / reportValidity().
 */
export function applyFormCustomValidity(form, fieldLabelFn) {
  if (!form) return;
  prepareFormFields(form, fieldLabelFn);
  form.querySelectorAll('input, select, textarea').forEach((field) => {
    if (typeof field.setCustomValidity === 'function') field.setCustomValidity('');
  });
  form.querySelectorAll('input[required], select[required], textarea[required]').forEach((field) => {
    const type = (field.getAttribute('type') || 'text').toLowerCase();
    if (field.disabled) return;
    if (['checkbox', 'radio'].includes(type)) {
      if (!field.checked) field.setCustomValidity(`${fieldLabelFn(field)} is required.`);
      return;
    }
    if (type === 'file') return;
    if (!String(field.value || '').trim()) field.setCustomValidity(`${fieldLabelFn(field)} is required.`);
  });
  const password = form.querySelector('[name="password"]');
  const newPassword = form.querySelector('[name="newPassword"]');
  const confirmPassword = form.querySelector('[name="confirmPassword"]');
  const passwordSource = newPassword || password;
  if (passwordSource && confirmPassword && confirmPassword.value && passwordSource.value !== confirmPassword.value) {
    confirmPassword.setCustomValidity(`${fieldLabelFn(confirmPassword)} must match ${fieldLabelFn(passwordSource)}.`);
  }
}

/** Ensure each field has an id, its label has a for attribute, and an error slot exists. */
export function prepareFormFields(form, fieldErrorSlotFn) {
  if (!form) return;
  const fields = form.querySelectorAll('input, select, textarea');
  fields.forEach((field, index) => {
    const type = (field.getAttribute('type') || '').toLowerCase();
    if (['hidden', 'button', 'submit', 'reset'].includes(type)) return;
    if (!field.id) {
      const safeName = (field.name || field.type || `field-${index}`).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
      field.id = `${form.id || 'form'}-${safeName}-${index}`;
    }
    const label = Array.from(field.parentElement?.children || []).find((node) => node.tagName === 'LABEL' && !node.contains(field));
    if (label && !label.getAttribute('for')) label.setAttribute('for', field.id);
    if (fieldErrorSlotFn) fieldErrorSlotFn(field);
  });
}

/** Get a human-readable label for a form field. */
export function fieldLabel(field) {
  if (!field) return 'This field';
  const explicit = field.getAttribute('data-label') || field.getAttribute('aria-label');
  if (explicit) return explicit.trim();
  if (field.id) {
    const linked = field.form?.querySelector(`label[for="${CSS.escape(field.id)}"]`);
    if (linked) return linked.textContent.replace(/\s+/g, ' ').trim();
  }
  const wrapping = field.closest('label');
  if (wrapping) {
    const text = wrapping.textContent.replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return (field.name || 'This field').replace(/([A-Z])/g, ' $1').replace(/[-_]+/g, ' ').trim().replace(/^./, (x) => x.toUpperCase());
}

/** Ensure a `<div class="field-error">` slot exists after the field. Returns it. */
export function fieldErrorSlot(field) {
  if (!field?.form) return null;
  const type = (field.getAttribute('type') || '').toLowerCase();
  if (['hidden', 'button', 'submit', 'reset'].includes(type)) return null;
  const id = `${field.id}-error`;
  let slot = document.getElementById(id);
  if (!slot) {
    slot = document.createElement('div');
    slot.id = id;
    slot.className = 'field-error';
    const anchor = ['checkbox', 'radio'].includes(type) ? (field.closest('label') || field) : field;
    anchor.insertAdjacentElement('afterend', slot);
  }
  field.setAttribute('aria-describedby', id);
  return slot;
}

/** Get a user-friendly validation message for an invalid field. */
export function fieldValidationMessage(field, fieldLabelFn = fieldLabel) {
  const label = fieldLabelFn(field);
  if (field.validationMessage && field.validity.customError) return field.validationMessage;
  if (field.validity.valueMissing) return `${label} is required.`;
  if (field.validity.typeMismatch) {
    const type = (field.getAttribute('type') || '').toLowerCase();
    if (type === 'email') return `Enter a valid ${label.toLowerCase()}.`;
    return `${label} is invalid.`;
  }
  if (field.validity.patternMismatch && field.title) return `${label}: ${field.title}`;
  if (field.validity.tooShort) return `${label} is too short.`;
  if (field.validity.tooLong) return `${label} is too long.`;
  if (field.validity.rangeUnderflow) return `${label} must be at least ${field.min}.`;
  if (field.validity.rangeOverflow) return `${label} must be no more than ${field.max}.`;
  if (field.validity.stepMismatch) return `${label} has an invalid value.`;
  if (field.validity.badInput) return `${label} has an invalid value.`;
  return field.validationMessage || `${label} is invalid.`;
}

/** Toggle an error class and fill the error slot for a field. */
export function setFieldValidation(field, message = '') {
  if (!field || !field.willValidate) return;
  const slot = fieldErrorSlot(field);
  if (!slot) return;
  const hasError = !!message;
  field.classList.toggle('is-invalid', hasError);
  field.setAttribute('aria-invalid', hasError ? 'true' : 'false');
  slot.classList.toggle('visible', hasError);
  slot.textContent = message;
}

/** Clear all validation state on a form. */
export function clearFormValidation(form) {
  if (!form) return;
  form.querySelectorAll('input, select, textarea').forEach((field) => setFieldValidation(field, ''));
}

/**
 * Bind real-time validation to a form (idempotent — safe to call multiple times).
 * Automatically calls applyFormCustomValidity() on every input/change event.
 */
export function enhanceFormValidation(form) {
  if (!form || form.dataset.validationBound === '1') return;
  form.dataset.validationBound = '1';
  prepareFormFields(form, (f) => fieldErrorSlot(f));
  const update = (event) => {
    applyFormCustomValidity(form, fieldLabel);
    if (event?.target) setFieldValidation(event.target, '');
    const confirmPassword = form.querySelector('[name="confirmPassword"]');
    if (confirmPassword && event?.target && ['password', 'newPassword', 'confirmPassword'].includes(event.target.name)) {
      setFieldValidation(confirmPassword, '');
    }
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();
}

/**
 * Full form validation — returns true if all fields pass, false otherwise.
 * Highlights invalid fields and calls failFn('Form validation failed.').
 */
export function validateForm(form, failFn) {
  clearFormValidation(form);
  applyFormCustomValidity(form, fieldLabel);
  const invalidFields = Array.from(form.querySelectorAll('input, select, textarea'))
    .filter((f) => f.willValidate && !f.disabled && !f.checkValidity());
  if (!invalidFields.length) return true;
  invalidFields.forEach((f) => setFieldValidation(f, fieldValidationMessage(f)));
  invalidFields[0]?.focus();
  if (failFn) failFn('Form validation failed.');
  return false;
}

// =============================================================================
// Button helpers
// =============================================================================

/** Get the text label of a button (strips icon text). */
export function buttonLabelText(button) {
  if (!button) return '';
  if (button.dataset.weekNav !== undefined || button.dataset.payAdjust !== undefined) return '';
  return (button.querySelector('.btn-label')?.textContent || button.textContent || '').replace(/^[←↻◀▶]+\s*/, '').trim();
}

/** Enhance all buttons in the DOM with icon elements. */
export function enhanceButtons(iconForButtonFn) {
  document.querySelectorAll('button').forEach((button) => {
    if (button.dataset.iconSkip === '1') return;
    const iconName = iconForButtonFn(button);
    if (!iconName) return;
    button.dataset.iconDefault = iconName;
    let label = button.querySelector('.btn-label');
    if (!label) {
      const labelText = buttonLabelText(button);
      if (!labelText && button.dataset.weekNav) button.setAttribute('aria-label', button.dataset.weekNav === 'prev' ? 'Previous week' : 'Next week');
      if (!labelText && button.dataset.payAdjust !== undefined) button.setAttribute('aria-label', Number(button.dataset.payAdjust) < 0 ? 'Decrease amount' : 'Increase amount');
      if (labelText) button.setAttribute('aria-label', button.getAttribute('aria-label') || labelText);
      label = document.createElement('span');
      label.className = 'btn-label';
      label.textContent = labelText;
      button.textContent = '';
      button.appendChild(label);
    }
    let icon = button.querySelector('.btn-icon');
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'btn-icon material-symbols-rounded';
      icon.setAttribute('aria-hidden', 'true');
      button.prepend(icon);
    }
    if (!button.dataset.busy) icon.textContent = iconName;
  });
}

/** Update the visible label text of a button element. */
export function setButtonLabel(button, label, iconForButtonFn) {
  if (!button) return;
  const labelEl = button.querySelector('.btn-label');
  if (labelEl) labelEl.textContent = label;
  else button.textContent = label;
  if (iconForButtonFn) enhanceButtons(iconForButtonFn);
}

/**
 * Mark a button as busy (spinner) or idle.
 * Returns a release function: () => setButtonBusy(button, false)
 */
export function setButtonBusy(button, busy, iconForButtonFn) {
  if (!button) return () => {};
  if (iconForButtonFn) enhanceButtons(iconForButtonFn);
  const icon = button.querySelector('.btn-icon');
  button.dataset.busy = busy ? '1' : '';
  button.disabled = !!busy;
  if (icon) {
    icon.classList.toggle('material-symbols-rounded', !busy);
    if (busy) {
      icon.textContent = '';
      icon.classList.add('btn-spinner');
    } else {
      icon.classList.remove('btn-spinner');
      icon.classList.add('material-symbols-rounded');
      icon.textContent = button.dataset.iconDefault || (iconForButtonFn ? iconForButtonFn(button) : '') || 'check';
    }
  }
  return () => setButtonBusy(button, false, iconForButtonFn);
}
