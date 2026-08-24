import ExcelJS from 'exceljs'

/**
 * Spreadsheet export and XLSX reading, shared by products and customers.
 *
 * One place decides how a row becomes a cell, so a CSV and an XLSX of the same
 * data always agree — and so the export columns match the columns the importer
 * accepts, which is what makes "export, edit in Excel, import again" work at
 * all.
 */

/* -------------------------------- writing -------------------------------- */

/** Escapes a value for CSV: quote it if it holds a comma, quote or newline. */
const csvCell = (value) => {
  if (value == null) return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(columns, rows) {
  const head = columns.map((c) => csvCell(c.header)).join(',')
  const body = rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(','))
  /**
   * A UTF-8 BOM, so Excel on Windows opens Bangla names and the ৳ sign as text
   * rather than mojibake. Without it a customer export is unreadable for the
   * exact audience this shop serves.
   */
  return '﻿' + [head, ...body].join('\n') + '\n'
}

export async function toXlsx(columns, rows, sheetName = 'Sheet1') {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Goods by Sadia'
  wb.created = new Date()

  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }], // keep headers visible when scrolling
  })

  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.min(40, Math.max(12, String(c.header).length + 4)),
  }))

  rows.forEach((row) => ws.addRow(row))

  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6EAE7' } }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }

  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** `{ body, contentType, filename }` for whichever format was asked for. */
export async function buildExport({ format, columns, rows, name, sheetName }) {
  const stamp = new Date().toISOString().slice(0, 10)

  if (format === 'xlsx') {
    return {
      body: await toXlsx(columns, rows, sheetName ?? name),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${name}-${stamp}.xlsx`,
    }
  }
  if (format === 'json') {
    return {
      body: JSON.stringify(rows, null, 2),
      contentType: 'application/json; charset=utf-8',
      filename: `${name}-${stamp}.json`,
    }
  }
  return {
    body: toCsv(columns, rows),
    contentType: 'text/csv; charset=utf-8',
    filename: `${name}-${stamp}.csv`,
  }
}

/* -------------------------------- reading -------------------------------- */

/**
 * Reads the first worksheet of an uploaded .xlsx into plain objects, using the
 * first row as headers.
 *
 * Cells are flattened to strings so the rest of the import pipeline can treat
 * a spreadsheet exactly like a CSV — Excel hands back dates, formula results
 * and rich text objects that would otherwise reach the validator as `[object
 * Object]`.
 */
export async function xlsxToObjects(buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const ws = wb.worksheets[0]
  if (!ws) return []

  const headers = []
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellToString(cell.value)
  })

  const rows = []
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const obj = {}
    let any = false
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const key = headers[col]
      if (!key) return
      const value = cellToString(cell.value)
      if (value !== '') any = true
      obj[key] = value
    })
    // Excel files are full of blank rows below the data; skip them.
    if (any) rows.push(obj)
  })

  return rows
}

function cellToString(value) {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    // Formula cells carry `{ formula, result }`; hyperlinks carry `{ text }`;
    // rich text arrives as `{ richText: [{ text }] }`.
    if (value.result != null) return String(value.result)
    if (value.text != null) return String(value.text)
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join('')
    if (value.hyperlink) return String(value.hyperlink)
    return ''
  }
  return String(value)
}
