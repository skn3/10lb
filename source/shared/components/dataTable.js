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
//   rows — array of React <tr> elements (preferred) or arrays of cell values
//          (strings or React elements).
// =============================================================================

// Stable component reference so React doesn't unmount/remount on every render.
function DataTableScrollable({ headers, rows, emptyMessage, colSpan }) {
  const React = window.React;
  if (!React) return null;
  const e = React.createElement;
  const wrapRef = React.useRef(null);
  const scrollLeftRef = React.useRef(0);
  const span = colSpan ?? headers.length;

  React.useLayoutEffect(() => {
    if (wrapRef.current) wrapRef.current.scrollLeft = scrollLeftRef.current;
  });

  let bodyContent;
  if (rows.length === 0) {
    bodyContent = [e('tr', { key: '__empty' }, e('td', { colSpan: span, className: 'muted' }, emptyMessage))];
  } else {
    bodyContent = rows.map((row, rowIndex) => {
      // Already a React element (e.g. a <tr>)
      if (row && typeof row === 'object' && !Array.isArray(row) && row.type) return row;
      // Array of cell values
      if (Array.isArray(row)) {
        return e('tr', { key: rowIndex }, ...row.map((cell, cellIndex) => {
          if (cell && typeof cell === 'object' && !Array.isArray(cell) && cell.type) {
            return e('td', { key: cellIndex }, cell);
          }
          return e('td', { key: cellIndex }, String(cell ?? ''));
        }));
      }
      // Fallback: should not happen
      return e('tr', { key: rowIndex }, e('td', { colSpan: span }, String(row)));
    });
  }

  return e('div', {
    ref: wrapRef,
    style: { overflowX: 'auto' },
    onScroll: (event) => { scrollLeftRef.current = event.currentTarget.scrollLeft; }
  },
  e('table', { className: 'table' },
    e('thead', null, e('tr', null, ...headers.map((header, index) => e('th', { key: `${header}-${index}` }, header)))),
    e('tbody', null, ...bodyContent)
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
   * rows — array of React <tr> elements or arrays of cell values (strings or React elements).
   * @param {{ headers: string[], rows: Array, emptyMessage?: string, colSpan?: number }} opts
   * @returns {*} React element
   */
  renderReact({ headers = [], rows = [], emptyMessage = 'No data.', colSpan } = {}) {
    const React = window.React;
    if (!React) return null;
    return React.createElement(DataTableScrollable, { headers, rows, emptyMessage, colSpan });
  }
};
