<template>
  <div>
    <div class="privacy-banner">
      🔒 导出的数据是清洗后存储在浏览器中的版本，不会上传到任何服务器。
    </div>

    <div class="card">
      <div class="card-header">导出 CSV</div>
      <p style="color:var(--text-secondary);margin-bottom:12px;">
        导出当前清洗后的数据为 CSV 文件。当前数据共 {{ report.totalRows }} 行，{{ report.totalCols }} 列。
      </p>
      <button class="btn primary" @click="exportCSV">
        📥 导出 CSV
      </button>
    </div>

    <div class="card">
      <div class="card-header">导出分析报告</div>
      <p style="color:var(--text-secondary);margin-bottom:12px;">
        导出包含数据质量评分、列信息等分析结果的 JSON 报告。
      </p>
      <button class="btn" @click="exportReport">
        📄 导出分析报告 (JSON)
      </button>
    </div>

    <div class="card">
      <div class="card-header">数据集信息</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ formatNumber(report.totalRows) }}</div>
          <div class="stat-label">当前行数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ report.totalCols }}</div>
          <div class="stat-label">列数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" :class="scoreClass">{{ report.qualityScore }}</div>
          <div class="stat-label">数据质量评分</div>
        </div>
        <div class="stat-card">
          <div class="stat-value success">{{ report.totalMissing - (dataset.qualityReport ? 0 : 0) }}</div>
          <div class="stat-label">剩余缺失值</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ dataset && dataset.canUndo() ? '是' : '否' }}</div>
          <div class="stat-label">可撤销</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { downloadCSV, downloadJSON } from '../parser/index.js'

export default {
  props: {
    dataset: { type: Object, required: true },
    report: { type: Object, required: true }
  },
  computed: {
    scoreClass() {
      if (this.report.qualityScore >= 90) return 'success'
      if (this.report.qualityScore >= 70) return 'warning'
      return 'danger'
    }
  },
  methods: {
    formatNumber(n) {
      if (n === null || n === undefined) return '0'
      return Number(n).toLocaleString()
    },
    exportCSV() {
      const rows = this.dataset.getRows()
      const name = this.dataset.meta.name || 'export'
      const cleanName = name.replace(/\.csv$/i, '') + '_cleaned.csv'
      downloadCSV(rows, cleanName)
    },
    exportReport() {
      const report = {
        fileName: this.dataset.meta.name,
        exportedAt: new Date().toISOString(),
        rows: this.report.totalRows,
        columns: this.report.totalCols,
        missingValues: this.report.totalMissing,
        duplicates: this.report.duplicateRows,
        qualityScore: this.report.qualityScore,
        qualityBreakdown: this.report.qualityBreakdown,
        columnInfo: this.report.columns.map(c => ({
          name: c.name,
          type: c.type,
          nullCount: c.nullCount,
          uniqueCount: c.uniqueCount,
          statistics: c.statistics
        }))
      }
      const name = (this.dataset.meta.name || 'dataset').replace(/\.csv$/i, '') + '_report.json'
      downloadJSON(report, name)
    }
  }
}
</script>