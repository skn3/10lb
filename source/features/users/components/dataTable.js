// =============================================================================
// DATA TABLE — generic table component.
//
// render({ headers, rows, emptyMessage, colSpan })
//   Returns a `<table class="table">` HTML string.
//
//   headers      — array of strings (column header labels)
//   rows         — array of arrays of HTML cell content strings
//                  (cells are inserted as innerHTML — callers must escape user
//                   data with Utils.esc() / Utils.escAttr() before passing)
//   emptyMessage — text shown when rows is empty (default: 'No data.')
//   colSpan      — colspan for the empty row (defaults to headers.length)
//
// renderReact({ headers, rows, emptyMessage, colSpan })
//   Returns a React element wrapping the table in a scroll-preserving container.
// =============================================================================

// Stable component reference so React doesn't unmount/remount on every render.
function DataTableScrollable({ headers, rows, emptyMessage, colSpan }) {
  const React = window.React;
  if (!React) return null;
  const e = React.createElement;
  const wrapRef = React.useRef(null);
  const scrollLeftRef = React.useRef(0);
  const span = colSpan ?? headers.length;
  const bodyRows = rows.length === 0
    ? `<tr><td colspan="${span}" class="muted">${emptyMessage}</td></tr>`
    : rows.map((row) => {
      if (typeof row === 'string') return row;
      return `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
    }).join('');

  React.useLayoutEffect(() => {
    if (wrapRef.current) wrapRef.current.scrollLeft = scrollLeftRef.current;
  });

  return e('div', {
    ref: wrapRef,
    style: { overflowX: 'auto' },
    onScroll: (event) => { scrollLeftRef.current = event.currentTarget.scrollLeft; }
  },
  e('table', { className: 'table' },
    e('thead', null, e('tr', null, ...headers.map((header, index) => e('th', { key: `${header}-${index}` }, header)))),
    e('tbody', { dangerouslySetInnerHTML: { __html: bodyRows } })
  ));
}

export const DataTable = {
  /**
   * @param {{ headers: string[], rows: (string[][]|string[]|string)[], emptyMessage?: string, colSpan?: number }} opts
   * @returns {string}
   */
  render({ headers = [], rows = [], emptyMessage = 'No data.', colSpan } = {}) {
    const span = colSpan ?? headers.length;
    const headCells = headers.map((h) => `<th>${h}</th>`).join('');
    let bodyRows;
    if (rows.length === 0) {
      bodyRows = `<tr><td colspan="${span}" class="muted">${emptyMessage}</td></tr>`;
    } else {
      bodyRows = rows.map((row) => {
        if (typeof row === 'string') return row;
        return `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`;
      }).join('');
    }
    return `<table class="table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  },

  /**
   * React version with horizontal scroll preservation.
   * @param {{ headers: string[], rows: (string[][]|string[]|string)[], emptyMessage?: string, colSpan?: number }} opts
   * @returns {*} React element
   */
  renderReact({ headers = [], rows = [], emptyMessage = 'No data.', colSpan } = {}) {
    const React = window.React;
    if (!React) return null;
    return React.createElement(DataTableScrollable, { headers, rows, emptyMessage, colSpan });
  }
};
