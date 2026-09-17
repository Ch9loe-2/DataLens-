/**
 * Analysis engine - runs analysis on main thread or dispatches to Web Worker
 */

let worker = null

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/analysis.worker.js', import.meta.url), { type: 'module' })
  }
  return worker
}

export function runAnalysis(rows, useWorker = true) {
  if (!rows || rows.length === 0) {
    return Promise.resolve(null)
  }

  // For small datasets, run on main thread
  if (!useWorker || rows.length < 5000) {
    return Promise.resolve(runAnalysisSync(rows))
  }

  // For larger datasets, use Web Worker
  return new Promise((resolve, reject) => {
    const w = getWorker()

    const handler = (e) => {
      if (e.data.type === 'result') {
        w.removeEventListener('message', handler)
        w.removeEventListener('error', errorHandler)
        resolve(e.data.report)
      } else if (e.data.type === 'error') {
        w.removeEventListener('message', handler)
        w.removeEventListener('error', errorHandler)
        reject(new Error(e.data.error))
      }
    }

    const errorHandler = (err) => {
      w.removeEventListener('message', handler)
      reject(err)
    }

    w.addEventListener('message', handler)
    w.addEventListener('error', errorHandler)

    w.postMessage({ type: 'analyze', data: rows })
  })
}

export function terminateWorker() {
  if (worker) {
    worker.terminate()
    worker = null
  }
}

function detectType(values) {
  if (!values || values.length === 0) return 'string'
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '')
  if (nonNull.length === 0) return 'empty'

  const bools = nonNull.filter(v =>
    v.toLowerCase() === 'true' || v.toLowerCase() === 'false' || v === '1' || v === '0'
  )
  if (bools.length / nonNull.length > 0.9) return 'boolean'

  const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}[T ]\d{1,2}:\d{2}/
  const dates = nonNull.filter(v => datePattern.test(v) && !isNaN(new Date(v).getTime()))
  if (dates.length / nonNull.length > 0.8) return 'date'

  const numbers = nonNull.filter(v => !isNaN(parseFloat(v)) && isFinite(v))
  if (numbers.length / nonNull.length > 0.9) return 'number'

  return 'string'
}

function computeNumericStats(values) {
  const nums = values
    .filter(v => v !== null && v !== undefined && v !== '' && !isNaN(parseFloat(v)))
    .map(v => parseFloat(v))
  if (nums.length === 0) return null
  nums.sort((a, b) => a - b)
  const sum = nums.reduce((s, v) => s + v, 0)
  const mean = sum / nums.length
  const mid = Math.floor(nums.length / 2)
  const median = nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid]
  const freq = {}
  let maxFreq = 0
  let mode = nums[0]
  for (const n of nums) {
    freq[n] = (freq[n] || 0) + 1
    if (freq[n] > maxFreq) { maxFreq = freq[n]; mode = n }
  }
  const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / nums.length
  return {
    min: nums[0], max: nums[nums.length - 1],
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    mode: Math.round(mode * 100) / 100,
    stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
    count: nums.length,
    sum: Math.round(sum * 100) / 100
  }
}

function computeQualityScore(report) {
  let score = 100
  const breakdown = []

  // Missing penalty: up to -50
  const missingRate = report.totalRows > 0 ? report.totalMissing / (report.totalRows * report.totalCols) : 0
  const missingPenalty = Math.min(Math.round(missingRate * 50), 50)
  if (missingPenalty > 0) {
    score -= missingPenalty
    breakdown.push({ item: '缺失值', penalty: missingPenalty, detail: `共 ${report.totalMissing} 个缺失值` })
  }

  // Duplicate penalty: up to -30
  const duplicateRate = report.totalRows > 0 ? report.duplicateRows / report.totalRows : 0
  const duplicatePenalty = Math.min(Math.round(duplicateRate * 30), 30)
  if (duplicatePenalty > 0) {
    score -= duplicatePenalty
    breakdown.push({ item: '重复行', penalty: duplicatePenalty, detail: `共 ${report.duplicateRows} 行重复` })
  }

  // Invalid dates penalty: up to -20
  if (report.invalidDates > 0) {
    const invalidPenalty = Math.min(Math.round((report.invalidDates / Math.max(report.totalRows, 1)) * 20), 20)
    score -= invalidPenalty
    breakdown.push({ item: '无效日期', penalty: invalidPenalty, detail: `共 ${report.invalidDates} 个无效日期` })
  }

  return { score: Math.max(0, score), breakdown }
}

export function runAnalysisSync(rows) {
  if (!rows || rows.length === 0) return null

  const headers = Object.keys(rows[0])
  const totalRows = rows.length
  const totalCols = headers.length

  const columns = headers.map((name, i) => {
    const values = rows.map(r => r[name])
    const type = detectType(values)
    const nullCount = values.filter(v => v === null || v === undefined || v === '').length
    const uniqueVals = new Set(values)
    let stats = null
    if (type === 'number') stats = computeNumericStats(values)
    return { name, index: i, type, nullCount, nullable: nullCount > 0, uniqueCount: uniqueVals.size, statistics: stats }
  })

  let totalMissing = 0
  const missingByColumn = {}
  for (const col of columns) {
    totalMissing += col.nullCount
    if (col.nullCount > 0) missingByColumn[col.name] = col.nullCount
  }

  const seen = new Set()
  let duplicateRows = 0
  for (const row of rows) {
    const key = JSON.stringify(Object.values(row))
    if (seen.has(key)) duplicateRows++
    else seen.add(key)
  }

  let invalidDates = 0
  for (const col of columns) {
    if (col.type === 'date') {
      for (const row of rows) {
        const val = row[col.name]
        if (val && val !== '' && val !== null && val !== undefined) {
          if (isNaN(new Date(val).getTime())) invalidDates++
        }
      }
    }
  }

  const typeDistribution = {}
  for (const col of columns) {
    typeDistribution[col.type] = (typeDistribution[col.type] || 0) + 1
  }

  const report = {
    totalRows, totalCols, totalMissing,
    missingRate: totalRows > 0 ? Math.round((totalMissing / (totalRows * totalCols)) * 10000) / 100 : 0,
    duplicateRows,
    duplicateRate: totalRows > 0 ? Math.round((duplicateRows / totalRows) * 10000) / 100 : 0,
    invalidDates,
    columns, missingByColumn, typeDistribution
  }

  const quality = computeQualityScore(report)
  report.qualityScore = quality.score
  report.qualityBreakdown = quality.breakdown

  return report
}