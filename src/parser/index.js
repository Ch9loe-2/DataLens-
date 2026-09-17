/**
 * CSV Parser - wraps Papa Parse for CSV file parsing
 */
import Papa from 'papaparse'

export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: false, // Keep raw strings for type detection
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(results) {
        if (results.errors && results.errors.length > 0) {
          const critical = results.errors.filter(e => e.type === 'FieldMismatch' || e.type === 'Quotes')
          if (critical.length > 0 && results.data.length === 0) {
            reject(new Error(`CSV 解析错误: ${critical[0].message}`))
            return
          }
        }
        resolve({
          data: results.data,
          meta: results.meta,
          errors: results.errors || []
        })
      },
      error(err) {
        reject(err)
      }
    })
  })
}

export function generateCSV(rows) {
  if (!rows || rows.length === 0) return ''
  return Papa.unparse(rows)
}

export function downloadCSV(rows, filename = 'export.csv') {
  const csv = generateCSV(rows)
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export function downloadJSON(obj, filename = 'report.json') {
  const json = JSON.stringify(obj, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}