/**
 * Web Worker for CPU-intensive data analysis.
 * Processes CSV data off the main thread to prevent UI freezing.
 */

function detectType(values) {
  if (!values || values.length === 0) return 'string'
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '')
  if (nonNull.length === 0) return 'empty'

  // Check boolean
  const bools = nonNull.filter(v =>
    v.toLowerCase() === 'true' || v.toLowerCase() === 'false' || v === '1' || v === '0'
  )
  if (bools.length / nonNull.length > 0.9) return 'boolean'

  // Check date
  const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}[T ]\d{1,2}:\d{2}/
  const dates = nonNull.filter(v => datePattern.test(v) && !isNaN(new Date(v).getTime()))
  if (dates.length / nonNull.length > 0.8) return 'date'

  // Check number
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
    if (freq[n] > maxFreq) {
      maxFreq = freq[n]
      mode = n
    }
  }

  const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / nums.length
  const stdDev = Math.sqrt(variance)

  return {
    min: nums[0],
    max: nums[nums.length - 1],
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    mode: Math.round(mode * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    count: nums.length,
    sum: Math.round(sum * 100) / 100
  }
}

function computeQualityScore(report) {
  let score = 100
  const breakdown = []

  const missingPenalty = Math.min(Math.round((report.totalMissing / Math.max(report.totalRows, 1)) * 50), 50)
  if (missingPenalty > 0) {
    score -= missingPenalty
    breakdown.push({ item: '缺失值', penalty: missingPenalty, detail: `共 ${report.totalMissing} 个缺失值` })
  }

  const duplicatePenalty = Math.min(Math.round((report.duplicateRows / Math.max(report.totalRows, 1)) * 30), 30)
  if (duplicatePenalty > 0) {
    score -= duplicatePenalty
    breakdown.push({ item: '重复行', penalty: duplicatePenalty, detail: `共 ${report.duplicateRows} 行重复` })
  }

  const invalidPenalty = Math.min(Math.round((report.invalidDates / Math.max(report.totalRows, 1)) * 20), 20)
  if (invalidPenalty > 0) {
    score -= invalidPenalty
    breakdown.push({ item: '无效日期', penalty: invalidPenalty, detail: `共 ${report.invalidDates} 个无效日期` })
  }

  return { score: Math.max(0, score), breakdown }
}

self.onmessage = function (e) {
  const { type, data } = e.data

  if (type === 'analyze') {
    try {
      const rows = data
      if (!rows || rows.length === 0) {
        self.postMessage({ type: 'result', error: 'No data to analyze' })
        return
      }

      const headers = Object.keys(rows[0])
      const totalRows = rows.length
      const totalCols = headers.length

      // Column analysis
      const columns = headers.map((name, i) => {
        const values = rows.map(r => r[name])
        const type = detectType(values)
        const nullCount = values.filter(v => v === null || v === undefined || v === '').length
        const uniqueVals = new Set(values)
        let stats = null
        if (type === 'number') {
          stats = computeNumericStats(values)
        }
        return { name, index: i, type, nullCount, nullable: nullCount > 0, uniqueCount: uniqueVals.size, statistics: stats }
      })

      // Missing values
      let totalMissing = 0
      const missingByColumn = {}
      for (const col of columns) {
        totalMissing += col.nullCount
        if (col.nullCount > 0) {
          missingByColumn[col.name] = col.nullCount
        }
      }

      // Duplicate rows
      const seen = new Set()
      let duplicateRows = 0
      for (const row of rows) {
        const key = JSON.stringify(Object.values(row))
        if (seen.has(key)) duplicateRows++
        else seen.add(key)
      }

      // Invalid date detection
      let invalidDates = 0
      for (const col of columns) {
        if (col.type === 'date') {
          const dateValues = rows.map(r => r[col.name])
          for (const val of dateValues) {
            if (val && val !== '' && val !== null && val !== undefined) {
              const d = new Date(val)
              if (isNaN(d.getTime())) invalidDates++
            }
          }
        }
      }

      // Type distribution
      const typeDistribution = {}
      for (const col of columns) {
        typeDistribution[col.type] = (typeDistribution[col.type] || 0) + 1
      }

      const report = {
        totalRows,
        totalCols,
        totalMissing,
        missingRate: totalRows > 0 ? Math.round((totalMissing / (totalRows * totalCols)) * 10000) / 100 : 0,
        duplicateRows,
        duplicateRate: totalRows > 0 ? Math.round((duplicateRows / totalRows) * 10000) / 100 : 0,
        invalidDates,
        columns: columns,
        missingByColumn,
        typeDistribution
      }

      const quality = computeQualityScore(report)
      report.qualityScore = quality.score
      report.qualityBreakdown = quality.breakdown

      self.postMessage({ type: 'result', report })
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message })
    }
  }
}