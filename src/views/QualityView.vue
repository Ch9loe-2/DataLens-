<template>
  <div>
    <div class="card">
      <div class="card-header">数据质量评分</div>
      <div class="quality-score">
        <div class="score-circle" :class="scoreClass">
          {{ report.qualityScore }}
        </div>
        <div class="breakdown">
          <div v-if="report.qualityBreakdown && report.qualityBreakdown.length > 0">
            <div class="breakdown-item">
              <span class="label">基础分</span>
              <span>100</span>
            </div>
            <div class="breakdown-item" v-for="item in report.qualityBreakdown" :key="item.item">
              <span class="label">{{ item.item }}</span>
              <span class="penalty">-{{ item.penalty }}</span>
              <span style="color:var(--text-muted);font-size:12px;">{{ item.detail }}</span>
            </div>
          </div>
          <div v-else style="color:var(--text-secondary);">
            未检测到数据质量问题，满分 100。
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">缺失值分析</div>
      <div style="margin-bottom:8px;">
        总缺失值: <strong style="color:var(--danger);">{{ report.totalMissing }}</strong>
        ({{ report.missingRate }}%)
      </div>
      <div v-if="missingCols.length > 0">
        <table class="data-table">
          <thead>
            <tr>
              <th>列名</th>
              <th>缺失数</th>
              <th>缺失率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="col in report.columns" :key="col.name">
              <td>{{ col.name }}</td>
              <td>
                <span v-if="col.nullCount > 0" style="color:var(--danger);">{{ col.nullCount }}</span>
                <span v-else style="color:var(--success);">0</span>
              </td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="progress-bar" style="max-width:200px;">
                    <div
                      class="fill"
                      :style="{ width: (col.nullCount / report.totalRows * 100) + '%', background: col.nullCount > 0 ? 'var(--danger)' : 'var(--success)' }"
                    ></div>
                  </div>
                  <span style="font-size:12px;">
                    {{ (col.nullCount / report.totalRows * 100).toFixed(1) }}%
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else style="color:var(--success);font-weight:600;">
        ✅ 没有检测到缺失值
      </div>
    </div>

    <div class="card">
      <div class="card-header">重复数据分析</div>
      <div>
        重复行数: <strong style="color:var(--danger);">{{ report.duplicateRows }}</strong>
        ({{ report.duplicateRate }}%)
      </div>
    </div>

    <div class="card">
      <div class="card-header">列类型分布</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <div v-for="(count, type) in report.typeDistribution" :key="type" class="stat-card" style="min-width:100px;">
          <div class="stat-value" style="font-size:20px;">{{ count }}</div>
          <div class="stat-label">
            <span class="type-badge" :class="type">{{ type }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="report.invalidDates > 0" class="card">
      <div class="card-header">无效日期</div>
      <div>
        检测到 <strong style="color:var(--danger);">{{ report.invalidDates }}</strong> 个无效日期字段
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    report: { type: Object, required: true }
  },
  computed: {
    scoreClass() {
      if (this.report.qualityScore >= 90) return 'success'
      if (this.report.qualityScore >= 70) return 'warning'
      return 'danger'
    },
    missingCols() {
      return this.report.columns.filter(c => c.nullCount > 0)
    }
  }
}
</script>