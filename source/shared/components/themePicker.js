import { Utils } from '../utils/utils.js';
import { ThemeAlias } from '../../constants.js';

// =============================================================================
// THEME PICKER — reusable theme selector component.
//
// ThemePicker.render({ options, selectedValue, defaultTheme, inputName })
//   options       — ThemeOptions array: { key, label }[]
//   selectedValue — currently saved theme key (may be null = "Default")
//   defaultTheme  — the fallback theme key (used for "Use Default" button + preview)
//   inputName     — name attribute for the <select> (default: 'theme')
//
// ThemePicker.renderReact({ options, selectedValue, defaultTheme, inputName, onChange })
//   Returns a React element (stable component reference).
//
// ThemePicker.bind(container)
//   Wires live-preview onChange and "Use Default" button inside `container`.
//   Call after rendering. The live preview writes to document.body data-theme
//   but does NOT persist the value.
//
// ThemePicker.resolveTheme(userTheme, appTheme, configTheme)
//   Returns the first non-null theme, falling back to 'teal'.
// =============================================================================

// Stable component reference so React doesn't unmount/remount on every call.
function ThemePickerReact({ options, selectedValue, defaultTheme, inputName, onChange }) {
  const React = window.React;
  if (!React) return null;
  const e = React.createElement;
  const [selected, setSelected] = React.useState(selectedValue || '');
  React.useEffect(() => {
    setSelected(selectedValue || '');
  }, [selectedValue]);
  React.useEffect(() => {
    const resolved = selected || defaultTheme || 'teal';
    document.body.setAttribute('data-theme', ThemeAlias[resolved] || resolved);
  }, [selected, defaultTheme]);

  const resolvedDisplay = selected || defaultTheme || 'teal';
  const resolvedLabel = (options || []).find((o) => o.key === resolvedDisplay)?.label || resolvedDisplay;
  const showUseDefault = !!selected && selected !== defaultTheme;

  const handleChange = (value) => {
    setSelected(value);
    if (typeof onChange === 'function') onChange(value || null);
  };

  return e('div', { className: 'theme-picker', 'data-default-theme': defaultTheme || '' },
    e('label', null, 'Theme'),
    e('div', { className: 'row', style: { gap: '8px', alignItems: 'center' } },
      e('select', {
        name: inputName || 'theme',
        value: selected,
        style: { flex: 1 },
        onChange: (event) => handleChange(event.target.value)
      },
      e('option', { value: '' }, 'Default'),
      ...(options || []).map((theme) => e('option', { key: theme.key, value: theme.key }, theme.label))
      ),
      showUseDefault
        ? e('button', {
          type: 'button',
          className: 'btn danger small',
          onClick: () => handleChange('')
        }, 'Use Default')
        : null
    ),
    e('div', { className: 'small muted', style: { marginTop: '4px' } }, 'Theme: ', e('strong', null, resolvedLabel))
  );
}

export const ThemePicker = {
  resolveTheme(userTheme, appTheme, configTheme) {
    const raw = userTheme || appTheme || configTheme || 'teal';
    return ThemeAlias[raw] || raw;
  },

  render({ options = [], selectedValue = null, defaultTheme = 'teal', inputName = 'theme' }) {
    const resolvedDisplay = selectedValue || defaultTheme || 'teal';
    const resolvedLabel = options.find((o) => o.key === resolvedDisplay)?.label || resolvedDisplay;
    const showUseDefault = selectedValue !== null && selectedValue !== defaultTheme;
    return `<div class="theme-picker" data-default-theme="${Utils.escAttr(defaultTheme || '')}">
      <label>Theme</label>
      <div class="row" style="gap:8px;align-items:center">
        <select name="${Utils.escAttr(inputName)}" data-theme-picker-select style="flex:1">
          <option value="" ${!selectedValue ? 'selected' : ''}>Default</option>
          ${options.map((t) => `<option value="${Utils.escAttr(t.key)}" ${selectedValue === t.key ? 'selected' : ''}>${Utils.esc(t.label)}</option>`).join('')}
        </select>
        ${showUseDefault ? `<button type="button" class="btn danger small" data-theme-use-default>Use Default</button>` : ''}
      </div>
      <div class="small muted" style="margin-top:4px">Theme: <strong>${Utils.esc(resolvedLabel)}</strong></div>
    </div>`;
  },

  /**
   * React version of the theme picker with live preview.
   * @param {{ options, selectedValue, defaultTheme, inputName, onChange }} opts
   * @returns {*} React element
   */
  renderReact({ options = [], selectedValue = null, defaultTheme = 'teal', inputName = 'theme', onChange } = {}) {
    const React = window.React;
    if (!React) return null;
    return React.createElement(ThemePickerReact, { options, selectedValue, defaultTheme, inputName, onChange });
  },

  bind(container) {
    if (!container) return;
    const select = container.querySelector('[data-theme-picker-select]');
    const picker = container.querySelector('.theme-picker');
    if (!select || !picker) return;
    const defaultTheme = picker.dataset.defaultTheme || 'teal';

    const applyLiveTheme = (key) => {
      const resolved = key || defaultTheme || 'teal';
      document.body.setAttribute('data-theme', ThemeAlias[resolved] || resolved);
    };

    select.onchange = () => applyLiveTheme(select.value);

    const wireUseDefault = () => {
      const btn = container.querySelector('[data-theme-use-default]');
      if (btn) btn.onclick = () => {
        select.value = '';
        applyLiveTheme('');
        // Re-render the helper text / button inline without a full page render
        const muted = picker.querySelector('.small.muted');
        if (muted) {
          const label = select.options[select.selectedIndex]?.text || defaultTheme;
          muted.innerHTML = `Theme: <strong>${Utils.esc(label)}</strong>`;
        }
        btn.remove();
      };
    };
    wireUseDefault();
  }
};
