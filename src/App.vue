<template>
  <div id="app-root">
    <aside class="sidebar">
      <div class="sidebar-header">
        <span>🔍</span> DataLens
      </div>
      <nav class="sidebar-nav">
        <div
          class="sidebar-item"
          :class="{ active: currentView === 'import', disabled: false }"
          @click="currentView = 'import'"
        >
          📂 导入数据
        </div>
        <div
          class="sidebar-item"
          :class="{ active: currentView === 'overview', disabled: !hasData }"
          @click="hasData && (currentView = 'overview')"
        >
          📊 概览
        </div>
        <div
          class="sidebar-item"
          :class="{ active: currentView === 'quality', disabled: !hasData }"
          @click="hasData && (currentView = 'quality')"
        >
          ✅ 数据质量
        </div>
        <div
          class="sidebar-item"
          :class="{ active: currentView === 'cleaning', disabled: !hasData }"
          @click="hasData && (currentView = 'cleaning')"
        >
          🧹 数据清洗
        </div>
        <div
          class="sidebar-item"
          :class="{ active: currentView === 'charts', disabled: !hasData }"
          @click="hasData && (currentView = 'charts')"
        >
          📈 可视化
        </div>
        <div
          class="sidebar-item"
          :class="{ active: currentView === 'export', disabled: !hasData }"
          @click="hasData && (currentView = 'export')"
        >
          💾 导出
        </div>
      </nav>
      <div style="padding:12px 16px;font-size:11px;color:var(--text-muted);border-top:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
          <span style="color:var(--success);font-size:14px;">●</span>
          纯本地处理
        </div>
        <div>数据不上传服务器</div>
        <div style="margin-top:10px;display:flex;align-items:center;gap:6px;cursor:pointer;" @click="toggleTheme">
          <span>{{ isDark ? '☀️' : '🌙' }}</span>
          <span>{{ isDark ? '浅色模式' : '暗色模式' }}</span>
        </div>
      </div>
    </aside>

    <main class="main-content">
      <div class="top-bar">
        <h2>{{ pageTitle }}</h2>
        <div style="flex:1"></div>
        <div v-if="hasData" class="privacy-banner" style="margin-bottom:0;padding:4px 12px;font-size:11px;">
          🔒 数据仅在浏览器本地处理
        </div>
      </div>
      <div class="page-body">
        <ImportView
          v-if="currentView === 'import'"
          @data-imported="onDataImported"
        />
        <OverviewView
          v-else-if="currentView === 'overview'"
          :dataset="dataset"
          :report="report"
        />
        <QualityView
          v-else-if="currentView === 'quality'"
          :report="report"
        />
        <CleaningView
          v-else-if="currentView === 'cleaning'"
          :dataset="dataset"
          :report="report"
          @dataset-updated="onDatasetUpdated"
        />
        <ChartsView
          v-else-if="currentView === 'charts'"
          :dataset="dataset"
          :report="report"
        />
        <ExportView
          v-else-if="currentView === 'export'"
          :dataset="dataset"
          :report="report"
        />
      </div>
    </main>
  </div>
</template>

<script>
const ImportView = () => import('./views/ImportView.vue')
const OverviewView = () => import('./views/OverviewView.vue')
const QualityView = () => import('./views/QualityView.vue')
const CleaningView = () => import('./views/CleaningView.vue')
const ChartsView = () => import('./views/ChartsView.vue')
const ExportView = () => import('./views/ExportView.vue')
import Dataset from './models/Dataset.js'
import { runAnalysis } from './analysis/index.js'

export default {
  name: 'App',
  components: {
    ImportView,
    OverviewView,
    QualityView,
    CleaningView,
    ChartsView,
    ExportView
  },
  data() {
    return {
      currentView: 'import',
      dataset: null,
      report: null,
      isDark: false
    }
  },
  created() {
    // Restore theme preference
    const saved = localStorage.getItem('datalens-theme')
    if (saved === 'dark') {
      this.isDark = true
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  },
  computed: {
    hasData() {
      return this.dataset && this.dataset.getRows().length > 0
    },
    pageTitle() {
      const titles = {
        import: '导入数据',
        overview: '数据集概览',
        quality: '数据质量分析',
        cleaning: '数据清洗',
        charts: '数据可视化',
        export: '导出'
      }
      return titles[this.currentView] || 'DataLens'
    }
  },
  methods: {
    async onDataImported({ parsedData, fileName }) {
      const ds = new Dataset()
      ds.meta.name = fileName
      ds.importData(parsedData)

      this.dataset = ds

      const rows = ds.getRows()
      const result = await runAnalysis(rows)
      this.report = result
      if (result) {
        ds.qualityReport = result
      }

      this.currentView = 'overview'
    },
    onDatasetUpdated() {
      const rows = this.dataset.getRows()
      runAnalysis(rows).then(result => {
        this.report = result
        if (result) {
          this.dataset.qualityReport = result
        }
      })
    },
    toggleTheme() {
      this.isDark = !this.isDark
      if (this.isDark) {
        document.documentElement.setAttribute('data-theme', 'dark')
        localStorage.setItem('datalens-theme', 'dark')
      } else {
        document.documentElement.removeAttribute('data-theme')
        localStorage.setItem('datalens-theme', 'light')
      }
    }
  }
}
</script>