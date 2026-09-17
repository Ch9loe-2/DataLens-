/**
 * Cleaning engine - transforms dataset rows
 */

export function removeDuplicates(rows) {
  const seen = new Set()
  const result = []
  let removed = 0
  for (const row of rows) {
    const key = JSON.stringify(Object.values(row))
    if (seen.has(key)) {
      removed++
    } else {
      seen.add(key)
      result.push(row)
    }
  }
  return { rows: result, removed }
}

export function removeRowsWithMissing(rows, columns) {
  const result = []
  let removed = 0
  for (const row of rows) {
    const hasMissing = columns.some(col => row[col] === null || row[col] === undefined || row[col] === '')
    if (hasMissing) {
      removed++
    } else {
      result.push(row)
    }
  }
  return { rows: result, removed }
}

export function fillMissingNumeric(rows, column, strategy) {
  const values = rows.map(r => parseFloat(r[column])).filter(v => !isNaN(v))
  let fillValue

  if (strategy === 'mean') {
    fillValue = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
  } else if (strategy === 'median') {
    values.sort((a, b) => a - b)
    const mid = Math.floor(values.length / 2)
    fillValue = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid]
  } else if (strategy === 'zero') {
    fillValue = 0
  } else if (strategy === 'mode') {
    const freq = {}
    let maxFreq = 0
    let mode = 0
    for (const v of values) {
      freq[v] = (freq[v] || 0) + 1
      if (freq[v] > maxFreq) { maxFreq = freq[v]; mode = v }
    }
    fillValue = mode
  } else {
    fillValue = 0
  }

  fillValue = Math.round(fillValue * 100) / 100
  let filled = 0
  const result = rows.map(row => {
    if (row[column] === null || row[column] === undefined || row[column] === '') {
      filled++
      return { ...row, [column]: String(fillValue) }
    }
    return { ...row }
  })

  return { rows: result, filled, fillValue }
}

export function fillMissingString(rows, column, value = 'Unknown') {
  let filled = 0
  const result = rows.map(row => {
    if (row[column] === null || row[column] === undefined || row[column] === '') {
      filled++
      return { ...row, [column]: value }
    }
    return { ...row }
  })
  return { rows: result, filled, fillValue: value }
}

export function convertType(rows, column, targetType) {
  let converted = 0
  let failed = 0
  const result = rows.map(row => {
    const val = row[column]
    if (val === null || val === undefined || val === '') return { ...row }

    if (targetType === 'number') {
      const num = parseFloat(val)
      if (!isNaN(num)) {
        converted++
        return { ...row, [column]: String(num) }
      }
      failed++
    } else if (targetType === 'string') {
      converted++
      return { ...row, [column]: String(val) }
    } else if (targetType === 'date') {
      const d = new Date(val)
      if (!isNaN(d.getTime())) {
        converted++
        return { ...row, [column]: d.toISOString().split('T')[0] }
      }
      failed++
    }

    return { ...row }
  })

  return { rows: result, converted, failed }
}

/**
 * Delete a column from all rows
 */
export function deleteColumn(rows, columnName) {
  let removed = 0
  const result = rows.map(row => {
    const { [columnName]: _, ...rest } = row
    removed++
    return rest
  })
  return { rows: result, removed: rows.length }
}

/**
 * Rename a column
 */
export function renameColumn(rows, oldName, newName) {
  const result = rows.map(row => {
    const newRow = { ...row }
    newRow[newName] = newRow[oldName]
    delete newRow[oldName]
    return newRow
  })
  return { rows: result }
}

/**
 * Advanced filter — apply conditions to rows
 * conditions: [{ column, operator: 'equals'|'contains'|'gt'|'lt'|'gte'|'lte'|'notEmpty'|'empty', value }]
 */
export function applyFilter(rows, conditions, matchAll = true) {
  if (!conditions || conditions.length === 0) return { rows: [...rows], matched: rows.length }

  const result = rows.filter(row => {
    const results = conditions.map(cond => {
      const cell = row[cond.column]
      const val = cond.value

      switch (cond.operator) {
        case 'equals':
          return String(cell || '') === String(val || '')
        case 'notEquals':
          return String(cell || '') !== String(val || '')
        case 'contains':
          return String(cell || '').toLowerCase().includes(String(val || '').toLowerCase())
        case 'notContains':
          return !String(cell || '').toLowerCase().includes(String(val || '').toLowerCase())
        case 'gt':
          return parseFloat(cell) > parseFloat(val)
        case 'lt':
          return parseFloat(cell) < parseFloat(val)
        case 'gte':
          return parseFloat(cell) >= parseFloat(val)
        case 'lte':
          return parseFloat(cell) <= parseFloat(val)
        case 'empty':
          return cell === null || cell === undefined || cell === ''
        case 'notEmpty':
          return cell !== null && cell !== undefined && cell !== ''
        default:
          return true
      }
    })

    return matchAll ? results.every(Boolean) : results.some(Boolean)
  })

  return { rows: result, removed: rows.length - result.length, matched: result.length }
}