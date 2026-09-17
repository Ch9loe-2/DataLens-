<template>
  <div>
    <div class="card">
      <div class="card-header">数据集信息</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ formatNumber(report.totalRows) }}</div>
          <div class="stat-label">行数 (Rows)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ report.totalCols }}</div>
          <div class="stat-label">列数 (Columns)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" :class="scoreClass">{{ report.qualityScore }}</div>
          <div class="stat-label">数据质量评分</div>
        </div>
        <div class="stat-card">
          <div class="stat-value warning">{{ report.totalMissing }}</div>
          <div class="stat-label">缺失值</div>
        </div>
        <div class="stat-card">
          <div class="stat-value danger">{{ report.duplicateRows }}</div>
          <div class="stat-label">重复行</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">列信息</div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>列名</th>
              <th>类型</th>
              <th>非空值</th>
              <th>缺失值</th>
              <th>唯一值</th>
              <th v-if="hasNumericStats">最小值</th>
              <th v-if="hasNumericStats">最大值</th>
              <th v-if="hasNumericStats">平均值</th>
              <th v-if="hasNumericStats">中位数</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="col in report.columns" :key="col.name">
              <td><strong>{{ col.name }}</strong></td>
              <td><span class="type-badge" :class="col.type">{{ col.type }}</span></td>
              <td>{{ formatNumber(report.totalRows - col.nullCount) }}</td>
              <td>
                <span v-if="col.nullCount > 0" style="color:var(--danger);">
                  {{ col.nullCount }}
                </span>
                <span v-else style="color:var(--text-muted);">0</span>
              </td>
              <td>{{ col.uniqueCount }}</td>
              <td v-if="col.statistics">{{ col.statistics.min }}</td>
              <td v-if="col.statistics">{{ col.statistics.max }}</td>
              <td v-if="col.statistics">{{ col.statistics.mean }}</td>
              <td v-if="col.statistics">{{ col.statistics.median }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">数据预览</div>
      <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;">
        <input
          type="text"
          v-model="searchInput"
          placeholder="搜索数据..."
          style="flex:1;padding:7px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;"
        />
        <span style="font-size:12px;color:var(--text-secondary);">
          显示 {{ previewRows.length }} / {{ report.totalRows }} 行
        </span>
      </div>
      <div class="table-container" style="max-height:400px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th v-for="col in report.columns" :key="col.name"
                @click="sortBy = col.name; sortAsc = !sortAsc"
                style="cursor:pointer;user-select:none;">
                {{ col.name }}
                <span v-if="sortBy === col.name">{{ sortAsc ? ' ↑' : ' ↓' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in paginatedRows" :key="idx">
              <td style="color:var(--text-muted);font-size:11px;">{{ currentPage * pageSize + idx + 1 }}</td>
              <td v-for="col in report.columns" :key="col.name">
                <span v-if="row[col.name] === null || row[col.name] === undefined || row[col.name] === ''"
                      class="missing-badge">(空)</span>
                <span v-else :title="row[col.name]">{{ truncate(row[col.name], 30) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <button class="btn sm" :disabled="currentPage === 0" @click="currentPage--">上一页</button>
        <span>第 {{ currentPage + 1 }} / {{ totalPages }} 页</span>
        <button class="btn sm" :disabled="currentPage >= totalPages - 1" @click="currentPage++">下一页</button>
      </div>
    </div>
  </div>
</template>

<script>
import { debounce } from '../utils/index.js'

export default {
  props: {
    dataset: { type: Object, default: null },
    report: { type: Object, default: null }
  },
  data() {
    return {
      currentPage: 0,
      pageSize: 50,
      searchInput: '',
      searchQuery: '',
      sortBy: '',
      sortAsc: true
    }
  },
  created() {
    this.debouncedSearch = debounce((val) => {
      this.searchQuery = val
    }, 300)
  },
  watch: {
    searchInput(val) {
      this.currentPage = 0
      this.debouncedSearch(val)
    }
  },
  computed: {
    scoreClass() {
      if (!this.report) return ''
      if (this.report.qualityScore >= 90) return 'success'
      if (this.report.qualityScore >= 70) return 'warning'
      return 'danger'
    },
    hasNumericStats() {
      return this.report && this.report.columns && this.report.columns.some(c => c.statistics)
    },
    previewRows() {
      if (!this.dataset || !this.report) return []
      let rows = this.dataset.getRows()

      // Search filter
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase()
        rows = rows.filter(row =>
          Object.values(row).some(v =>
            String(v || '').toLowerCase().includes(q)
          )
        )
      }

      // Sort
      if (this.sortBy) {
        rows = [...rows].sort((a, b) => {
          const va = a[this.sortBy] || ''
          const vb = b[this.sortBy] || ''
          if (!isNaN(parseFloat(va)) && !isNaN(parseFloat(vb))) {
            return this.sortAsc ? parseFloat(va) - parseFloat(vb) : parseFloat(vb) - parseFloat(va)
          }
          return this.sortAsc
            ? String(va).localeCompare(String(vb))
            : String(vb).localeCompare(String(va))
        })
      }

      return rows
    },
    totalPages() {
      return Math.ceil(this.previewRows.length / this.pageSize)
    },
    paginatedRows() {
      const start = this.currentPage * this.pageSize
      return this.previewRows.slice(start, start + this.pageSize)
    }
  },
  methods: {
    formatNumber(n) {
      if (n === null || n === undefined) return '0'
      return Number(n).toLocaleString()
    },
    truncate(str, len) {
      if (!str) return ''
      return str.length > len ? str.slice(0, len) + '...' : str
    }
  }
}
</script>