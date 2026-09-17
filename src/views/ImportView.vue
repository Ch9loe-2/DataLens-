<template>
  <div>
    <div class="privacy-banner">
      🔒 您的数据仅在浏览器本地处理，不会上传到任何服务器。
    </div>

    <div
      class="import-area"
      :class="{ dragover: isDragOver }"
      @click="triggerUpload"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @drop.prevent="onDrop"
    >
      <div class="icon">📁</div>
      <h3>导入 CSV 文件</h3>
      <p>点击选择文件或拖拽 CSV 文件到此处</p>
      <p style="margin-top:8px;font-size:12px;color:var(--text-muted);">
        支持 .csv 格式 · 数据纯本地处理
      </p>
      <input
        ref="fileInput"
        type="file"
        accept=".csv"
        style="display:none"
        @change="onFileSelected"
      />
    </div>

    <div v-if="loading" class="card" style="text-align:center;padding:32px;">
      <p>正在解析 CSV 文件...</p>
      <div class="progress-bar" style="margin-top:12px;max-width:300px;margin-left:auto;margin-right:auto;">
        <div class="fill" style="width:100%;background:var(--primary);animation: pulse 1.5s infinite;"></div>
      </div>
    </div>

    <div v-if="error" class="card" style="border-color:var(--danger);">
      <div style="color:var(--danger);font-weight:600;">❌ 导入失败</div>
      <p style="margin-top:8px;color:var(--text-secondary);">{{ error }}</p>
    </div>
  </div>
</template>

<script>
import { parseCSV } from '../parser/index.js'

export default {
  data() {
    return {
      isDragOver: false,
      loading: false,
      error: ''
    }
  },
  methods: {
    triggerUpload() {
      this.$refs.fileInput.click()
    },
    async onFileSelected(e) {
      const file = e.target.files[0]
      if (file) await this.processFile(file)
    },
    async onDrop(e) {
      this.isDragOver = false
      const file = e.dataTransfer.files[0]
      if (file) await this.processFile(file)
    },
    async processFile(file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        this.error = '仅支持 .csv 格式的文件'
        return
      }

      this.loading = true
      this.error = ''

      try {
        const parsed = await parseCSV(file)
        if (!parsed.data || parsed.data.length === 0) {
          this.error = 'CSV 文件为空或格式不正确'
          this.loading = false
          return
        }
        this.loading = false
        this.$emit('data-imported', {
          parsedData: parsed,
          fileName: file.name
        })
      } catch (err) {
        this.loading = false
        this.error = err.message || '解析 CSV 时出错'
      }
    }
  }
}
</script>