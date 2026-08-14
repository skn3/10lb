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
// =============================================================================
export const DataTable = {
  /**
   * @param {{ headers: string[], rows: string[][], emptyMessage?: string, colSpan?: number }} opts
   * @returns {string}
   */
  render({ headers = [], rows = [], emptyMessage = 'No data.', colSpan } = {}) {
    const span = colSpan ?? headers.length;
    const headCells = headers.map((h) => `<th>${h}</th>`).join('');
    let bodyRows;
    if (rows.length === 0) {
      bodyRows = `<tr><td colspan="${span}" class="muted">${emptyMessage}</td></tr>`;
    } else {
      bodyRows = rows.map((cells) =>
        `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`
      ).join('');
    }
    return `<table class="table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  }
};
