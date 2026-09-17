/**
 * Dataset model - holds the parsed data, columns, analysis results and history
 */
import Column from './Column.js'

export default class Dataset {
  constructor() {
    this.rawRows = []
    this.currentRows = []
    this.columns = []
    this.meta = {
      name: '',
      rowCount: 0,
      columnCount: 0,
      fileSize: 0,
      importedAt: null
    }
    this.qualityReport = null
    this.history = []
    this.historyIndex = -1
    this.originalRows = []
  }

  importData(parsedResult) {
    // Deep copy to avoid shared reference mutation between raw/current/original
    this.rawRows = JSON.parse(JSON.stringify(parsedResult.data))
    this.currentRows = JSON.parse(JSON.stringify(this.rawRows))
    this.originalRows = JSON.parse(JSON.stringify(this.rawRows))
    this.meta.rowCount = this.rawRows.length
    this.meta.columnCount = this.rawRows.length > 0 ? Object.keys(this.rawRows[0]).length : 0
    this.meta.importedAt = new Date().toISOString()
    this.history = []
    this.historyIndex = -1

    // Build column metadata
    if (this.rawRows.length > 0) {
      const headers = Object.keys(this.rawRows[0])
      this.columns = headers.map((name, i) => {
        const col = new Column(name, i)
        // Collect samples for type inference
        const samples = this.rawRows.slice(0, 1000).map(r => r[name])
        col.type = col.inferType(samples)
        const nullCount = this.rawRows.filter(r => r[name] === null || r[name] === undefined || r[name] === '').length
        col.nullCount = nullCount
        col.nullable = nullCount > 0
        // Unique count sample
        const uniqueVals = new Set(this.rawRows.slice(0, 5000).map(r => r[name]))
        col.uniqueCount = uniqueVals.size
        // Numeric stats
        if (col.type === 'number') {
          const numSamples = this.rawRows.slice(0, 5000).map(r => r[name])
          col.statistics = col.computeNumericStats(numSamples)
        }
        return col
      })
    }
  }

  saveSnapshot(operation) {
    this.history = this.history.slice(0, this.historyIndex + 1)
    this.history.push({
      operation,
      rows: JSON.parse(JSON.stringify(this.currentRows)),
      timestamp: Date.now()
    })
    this.historyIndex = this.history.length - 1
  }

  /**
   * Undo last operation.
   * history[i] stores the state BEFORE the i-th operation was applied.
   * Undoing restores history[historyIndex] (the state before the last operation).
   */
  undo() {
    if (this.historyIndex < 0) return false
    const snapshot = this.history[this.historyIndex]
    this.currentRows = JSON.parse(JSON.stringify(snapshot.rows))
    this.historyIndex--
    return true
  }

  canUndo() {
    return this.historyIndex >= 0
  }

  canRedo() {
    return this.historyIndex < this.history.length - 1
  }

  getRows() {
    return this.currentRows
  }

  getOriginalRows() {
    return this.originalRows
  }

  resetToOriginal() {
    this.currentRows = JSON.parse(JSON.stringify(this.originalRows))
    this.history = []
    this.historyIndex = -1
  }

  toJSON() {
    return {
      meta: this.meta,
      columns: this.columns.map(c => c.toJSON()),
      qualityReport: this.qualityReport,
      historySize: this.history.length
    }
  }
}