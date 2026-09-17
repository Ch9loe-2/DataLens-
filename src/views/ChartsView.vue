<template>
  <div>
    <div class="card">
      <div class="card-header">图表配置</div>
      <div class="form-row">
        <div class="form-group">
          <label>X 轴</label>
          <select v-model="xCol">
            <option value="">-- 选择 --</option>
            <option v-for="col in report.columns" :key="col.name" :value="col.name">
              {{ col.name }} ({{ col.type }})
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>Y 轴 / 值</label>
          <select v-model="yCol">
            <option value="">-- 选择 --</option>
            <option v-for="col in report.columns" :key="col.name" :value="col.name">
              {{ col.name }} ({{ col.type }})
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>图表类型</label>
          <select v-model="chartType">
            <option value="auto">自动推荐</option>
            <option value="line">折线图</option>
            <option value="bar">柱状图</option>
            <option value="pie">饼图</option>
            <option value="histogram">分布图</option>
          </select>
        </div>
      </div>
      <div v-if="recommendation" style="margin-top:8px;font-size:12px;color:var(--text-secondary);">
        推荐: <strong>{{ recommendation }}</strong>
      </div>
    </div>

    <div class="card">
      <div class="card-header">预览</div>
      <div v-if="chartBuilt" ref="chartRef" class="chart-container"></div>
      <div v-else style="text-align:center;padding:60px 20px;color:var(--text-muted);">
        <div style="font-size:48px;margin-bottom:12px;">📊</div>
        <p>选择字段和图表类型后显示图表</p>
      </div>
    </div>

    <!-- Single column distribution -->
    <div class="card" v-if="report.columns.length > 0">
      <div class="card-header">单列数值分布</div>
      <div class="form-group">
        <label>选择数值列</label>
        <select v-model="histogramCol">
          <option value="">-- 选择 --</option>
          <option v-for="col in numericColumns" :key="col.name" :value="col.name">
            {{ col.name }}
          </option>
        </select>
      </div>
    </div>

    <div class="card" v-if="histogramCol">
      <div class="card-header">{{ histogramCol }} 分布</div>
      <div ref="histogramRef" class="chart-container"></div>
    </div>
  </div>
</template>

<script>
import * as echarts from 'echarts'
import { buildLineChart, buildBarChart, buildPieChart, buildHistogram, getChartTypeRecommendation } from '../charts/index.js'

export default {
  props: {
    dataset: { type: Object, required: true },
    report: { type: Object, required: true }
  },
  data() {
    return {
      xCol: '',
      yCol: '',
      chartType: 'auto',
      histogramCol: '',
      chartBuilt: false,
      chartInstance: null,
      histInstance: null
    }
  },
  computed: {
    recommendation() {
      if (!this.xCol || !this.yCol) return ''
      const xInfo = this.report.columns.find(c => c.name === this.xCol)
      const yInfo = this.report.columns.find(c => c.name === this.yCol)
      if (!xInfo || !yInfo) return ''
      return getChartTypeRecommendation(xInfo, yInfo)
    },
    numericColumns() {
      return this.report.columns.filter(c => c.type === 'number')
    }
  },
  watch: {
    async xCol() { await this.buildChart() },
    async yCol() { await this.buildChart() },
    async chartType() { await this.buildChart() },
    async histogramCol() { await this.buildHistogram() }
  },
  methods: {
    async buildChart() {
      if (!this.xCol || !this.yCol || !this.dataset) return

      const rows = this.dataset.getRows().slice(0, 5000) // Limit for performance
      const xColInfo = this.report.columns.find(c => c.name === this.xCol)
      const yColInfo = this.report.columns.find(c => c.name === this.yCol)

      let resolvedType = this.chartType
      if (resolvedType === 'auto') {
        resolvedType = getChartTypeRecommendation(xColInfo, yColInfo)
      }

      let option

      if (resolvedType === 'pie') {
        // Pie chart: x col as category, y col as value
        const agg = {}
        for (const row of rows) {
          const key = row[this.xCol] || '(empty)'
          const val = parseFloat(row[this.yCol])
          if (!isNaN(val)) {
            agg[key] = (agg[key] || 0) + val
          }
        }
        const data = Object.entries(agg).slice(0, 20).map(([name, value]) => ({ name, value }))
        option = buildPieChart(data, `${this.xCol} - ${this.yCol}`)
      } else if (resolvedType === 'line') {
        // For date-based x axis, aggregate by date
        const xData = rows.map(r => r[this.xCol])
        const yData = rows.map(r => parseFloat(r[this.yCol]) || 0)
        option = buildLineChart(xData, yData, this.xCol, this.yCol)
      } else if (resolvedType === 'scatter') {
        // Use bar chart as fallback for scatter
        const xData = rows.map(r => r[this.xCol])
        const yData = rows.map(r => parseFloat(r[this.yCol]) || 0)
        option = buildBarChart(xData, yData, this.xCol, this.yCol, `${this.yCol} by ${this.xCol}`)
      } else {
        // Bar chart: aggregate by category
        if (xColInfo && xColInfo.type === 'number') {
          const xData = rows.map(r => r[this.xCol])
          const yData = rows.map(r => parseFloat(r[this.yCol]) || 0)
          option = buildBarChart(xData, yData, this.xCol, this.yCol)
        } else {
          const agg = {}
          for (const row of rows) {
            const key = row[this.xCol] || '(empty)'
            const val = parseFloat(row[this.yCol])
            if (!isNaN(val)) {
              agg[key] = (agg[key] || 0) + val
            }
          }
          const entries = Object.entries(agg).slice(0, 30)
          option = buildBarChart(entries.map(e => e[0]), entries.map(e => e[1]), this.xCol, this.yCol)
        }
      }

      this.$nextTick(() => {
        if (this.chartInstance) {
          this.chartInstance.dispose()
        }
        if (this.$refs.chartRef) {
          this.chartInstance = echarts.init(this.$refs.chartRef)
          this.chartInstance.setOption(option)
          this.chartBuilt = true
        }
      })
    },

    async buildHistogram() {
      if (!this.histogramCol) return
      const rows = this.dataset.getRows().slice(0, 10000)
      const values = rows.map(r => parseFloat(r[this.histogramCol])).filter(v => !isNaN(v))
      const option = buildHistogram(values, `${this.histogramCol} 分布`)

      this.$nextTick(() => {
        if (this.histInstance) {
          this.histInstance.dispose()
        }
        if (this.$refs.histogramRef) {
          this.histInstance = echarts.init(this.$refs.histogramRef)
          this.histInstance.setOption(option)
        }
      })
    }
  },
  beforeUnmount() {
    if (this.chartInstance) this.chartInstance.dispose()
    if (this.histInstance) this.histInstance.dispose()
  }
}
</script>