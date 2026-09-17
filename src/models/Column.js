export default class Column {
  constructor(name, index) {
    this.name = name
    this.index = index
    this.type = 'unknown'
    this.nullable = false
    this.nullCount = 0
    this.uniqueCount = 0
    this.sampleValues = []
    this.statistics = {}
  }

  inferType(values) {
    if (!values || values.length === 0) return 'string'

    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '')

    if (nonNullValues.length === 0) return 'empty'

    // Check boolean
    const bools = nonNullValues.filter(v => v.toLowerCase() === 'true' || v.toLowerCase() === 'false' || v === '1' || v === '0')
    if (bools.length / nonNullValues.length > 0.9) return 'boolean'

    // Check date
    const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}[T ]\d{1,2}:\d{2}/
    const dates = nonNullValues.filter(v => datePattern.test(v) && !isNaN(new Date(v).getTime()))
    if (dates.length / nonNullValues.length > 0.8) return 'date'

    // Check number
    const numbers = nonNullValues.filter(v => !isNaN(parseFloat(v)) && isFinite(v))
    if (numbers.length / nonNullValues.length > 0.9) {
      // If most values look like integers, prefer number for analysis
      const floats = numbers.filter(v => v.includes('.') || v.includes(','))
      if (floats.length / numbers.length < 0.1) return 'number'
      return 'number'
    }

    return 'string'
  }

  computeNumericStats(values) {
    const nums = values
      .filter(v => v !== null && v !== undefined && v !== '' && !isNaN(parseFloat(v)))
      .map(v => parseFloat(v))

    if (nums.length === 0) return null

    nums.sort((a, b) => a - b)

    const sum = nums.reduce((s, v) => s + v, 0)
    const mean = sum / nums.length
    const mid = Math.floor(nums.length / 2)
    const median = nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid]

    // Compute mode
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

    // Variance / StdDev
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

  toJSON() {
    return {
      name: this.name,
      index: this.index,
      type: this.type,
      nullable: this.nullable,
      nullCount: this.nullCount,
      uniqueCount: this.uniqueCount,
      statistics: this.statistics
    }
  }
}