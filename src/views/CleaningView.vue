<template>
  <div>
    <!-- Undo bar -->
    <div v-if="dataset && dataset.canUndo()" class="card" style="background:var(--primary-light);border-color:var(--primary);">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:13px;">📋 有可撤销的操作</span>
        <div class="btn-group">
          <button class="btn" @click="undo">&larr; 撤销</button>
        </div>
      </div>
    </div>

    <!-- Clean preview -->
    <div v-if="preview" class="card">
      <div class="card-header">清洗预览</div>
      <div class="cleaning-preview">
        <div class="stat">
          <div class="num">{{ report.totalRows }}</div>
          <span style="font-size:12px;color:var(--text-secondary);">清洗前</span>
        </div>
        <div class="stat">
          <div class="num green">{{ afterRows }}</div>
          <span style="font-size:12px;color:var(--text-secondary);">清洗后</span>
        </div>
        <div class="stat">
          <div class="num red">{{ affectedCount }}</div>
          <span style="font-size:12px;color:var(--text-secondary);">受影响</span>
        </div>
      </div>
      <div style="margin-top:8px;">
        <p v-if="preview.removed">移除: {{ preview.removed }} 行</p>
        <p v-if="preview.filled">填充: {{ preview.filled }} 个值</p>
        <p v-if="preview.converted">转换: {{ preview.converted }} 个值</p>
        <p v-if="preview.failed">转换失败: {{ preview.failed }} 个值</p>
      </div>
      <div class="btn-group" style="margin-top:12px;">
        <button class="btn primary" @click="applyClean">应用</button>
        <button class="btn" @click="preview = null">取消</button>
      </div>
    </div>

    <!-- Remove Duplicates -->
    <div class="card">
      <div class="card-header">删除重复行</div>
      <p style="color:var(--text-secondary);margin-bottom:8px;">
        检测到 {{ report.duplicateRows }} 行重复数据。
      </p>
      <button class="btn primary" @click="previewRemoveDuplicates" :disabled="report.duplicateRows === 0 || preview">
        删除重复行
      </button>
    </div>

    <!-- Missing values -->
    <div class="card">
      <div class="card-header">处理缺失值</div>
      <p style="color:var(--text-secondary);margin-bottom:12px;">
        检测到 {{ report.totalMissing }} 个缺失值。
      </p>

      <div class="form-row" style="margin-bottom:8px;">
        <div class="form-group">
          <label>选择列</label>
          <select v-model="missingColumn">
            <option value="">-- 选择列 --</option>
            <option v-for="col in missingColumns" :key="col.name" :value="col.name">
              {{ col.name }} (缺失: {{ col.nullCount }})
            </option>
          </select>
        </div>
      </div>

      <div v-if="missingColumn" class="btn-group">
        <template v-if="isNumericColumn(missingColumn)">
          <button class="btn sm" @click="previewFillMissing('mean')">均值填充</button>
          <button class="btn sm" @click="previewFillMissing('median')">中位数填充</button>
          <button class="btn sm" @click="previewFillMissing('zero')">0 填充</button>
        </template>
        <button class="btn sm" @click="previewFillMissing('unknown')">填充为 "Unknown"</button>
        <button class="btn sm danger" @click="previewRemoveMissing">删除缺失行</button>
      </div>
    </div>

    <!-- Type conversion -->
    <div class="card">
      <div class="card-header">类型转换</div>
      <div class="form-row">
        <div class="form-group">
          <label>选择列</label>
          <select v-model="convertColumn">
            <option value="">-- 选择列 --</option>
            <option v-for="col in report.columns" :key="col.name" :value="col.name">
              {{ col.name }} ({{ col.type }})
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>转换为</label>
          <select v-model="convertTarget">
            <option value="">-- 目标类型 --</option>
            <option value="number">Number</option>
            <option value="string">String</option>
            <option value="date">Date</option>
          </select>
        </div>
        <div class="form-group" style="align-self:flex-end;">
          <button class="btn primary" :disabled="!convertColumn || !convertTarget" @click="previewConvertType">
            转换
          </button>
        </div>
      </div>
    </div>

    <!-- Column editing -->
    <div class="card">
      <div class="card-header">列编辑</div>
      <div class="form-row" style="margin-bottom:8px;">
        <div class="form-group">
          <label>选择列</label>
          <select v-model="editColumn">
            <option value="">-- 选择列 --</option>
            <option v-for="col in report.columns" :key="col.name" :value="col.name">
              {{ col.name }}
            </option>
          </select>
        </div>
      </div>
      <div v-if="editColumn" class="form-row">
        <div class="form-group">
          <label>重命名为</label>
          <input v-model="renameTarget" placeholder="新列名" />
        </div>
        <div class="form-group" style="align-self:flex-end;">
          <button class="btn sm primary" @click="previewRenameColumn" :disabled="!renameTarget">重命名</button>
        </div>
        <div class="form-group" style="align-self:flex-end;">
          <button class="btn sm danger" @click="previewDeleteColumn">删除列</button>
        </div>
      </div>
    </div>

    <!-- Advanced filter -->
    <div class="card">
      <div class="card-header">高级筛选</div>
      <p style="color:var(--text-secondary);margin-bottom:8px;">
        按条件筛选数据行。
      </p>
      <div v-for="(cond, i) in filterConditions" :key="i" class="form-row" style="margin-bottom:6px;">
        <div class="form-group" style="flex:2;">
          <select v-model="cond.column">
            <option value="">-- 列 --</option>
            <option v-for="col in report.columns" :key="col.name" :value="col.name">{{ col.name }}</option>
          </select>
        </div>
        <div class="form-group" style="flex:2;">
          <select v-model="cond.operator">
            <option value="equals">等于</option>
            <option value="notEquals">不等于</option>
            <option value="contains">包含</option>
            <option value="notContains">不包含</option>
            <option value="gt">&gt;</option>
            <option value="lt">&lt;</option>
            <option value="gte">&gt;=</option>
            <option value="lte">&lt;=</option>
            <option value="empty">为空</option>
            <option value="notEmpty">不为空</option>
          </select>
        </div>
        <div class="form-group" style="flex:3;">
          <input v-model="cond.value" placeholder="值" :disabled="cond.operator === 'empty' || cond.operator === 'notEmpty'" />
        </div>
        <div class="form-group" style="align-self:flex-end;">
          <button class="btn sm danger" @click="filterConditions.splice(i, 1)">✕</button>
        </div>
      </div>
      <div class="btn-group" style="margin-top:8px;">
        <button class="btn sm" @click="addFilterCondition">+ 添加条件</button>
        <button class="btn primary sm" @click="previewApplyFilter" :disabled="filterConditions.length === 0">应用筛选</button>
      </div>
    </div>
  </div>
</template>

<script>
import { removeDuplicates, removeRowsWithMissing, fillMissingNumeric, fillMissingString, convertType, deleteColumn, renameColumn, applyFilter } from '../cleaning/index.js'

export default {
  props: {
    dataset: { type: Object, required: true },
    report: { type: Object, required: true }
  },
  data() {
    return {
      preview: null,
      missingColumn: '',
      convertColumn: '',
      convertTarget: '',
      editColumn: '',
      renameTarget: '',
      filterConditions: [],
      filterLogic: 'all'
    }
  },
  computed: {
    afterRows() {
      if (!this.preview) return this.report.totalRows
      return this.preview.rows ? this.preview.rows.length : this.report.totalRows
    },
    missingColumns() {
      return this.report.columns.filter(c => c.nullCount > 0)
    },
    affectedCount() {
      if (!this.preview) return 0
      return this.preview.removed || this.preview.filled || this.preview.converted || this.preview.failed || 0
    }
  },
  methods: {
    isNumericColumn(name) {
      const col = this.report.columns.find(c => c.name === name)
      return col && col.type === 'number'
    },

    previewRemoveDuplicates() {
      const result = removeDuplicates(this.dataset.getRows())
      this.preview = { ...result, op: 'removeDuplicates' }
    },

    previewFillMissing(strategy) {
      const col = this.missingColumn
      if (!col) return

      let result
      if (strategy === 'unknown') {
        result = fillMissingString(this.dataset.getRows(), col)
      } else {
        result = fillMissingNumeric(this.dataset.getRows(), col, strategy)
      }
      this.preview = { ...result, op: 'fillMissing', column: col, strategy }
    },

    previewRemoveMissing() {
      const col = this.missingColumn
      if (!col) return
      const result = removeRowsWithMissing(this.dataset.getRows(), [col])
      this.preview = { ...result, op: 'removeMissing', columns: [col] }
    },

    previewConvertType() {
      if (!this.convertColumn || !this.convertTarget) return
      const result = convertType(this.dataset.getRows(), this.convertColumn, this.convertTarget)
      this.preview = { ...result, op: 'convertType', column: this.convertColumn, target: this.convertTarget }
    },

    applyClean() {
      if (!this.preview || !this.dataset) return

      // Save snapshot for undo
      this.dataset.saveSnapshot(this.preview.op)

      const op = this.preview.op
      if (op === 'removeDuplicates' || op === 'fillMissing' || op === 'removeMissing' || op === 'convertType' ||
          op === 'renameColumn' || op === 'deleteColumn' || op === 'applyFilter') {
        this.dataset.currentRows = this.preview.rows
      }

      this.preview = null
      // Clear filter conditions after applying
      if (op === 'applyFilter') {
        this.filterConditions = []
      }
      this.$emit('dataset-updated')
    },

    undo() {
      if (this.dataset.undo()) {
        this.$emit('dataset-updated')
      }
    },

    // Column editing
    previewRenameColumn() {
      if (!this.editColumn || !this.renameTarget) return
      const result = renameColumn(this.dataset.getRows(), this.editColumn, this.renameTarget)
      this.preview = { ...result, op: 'renameColumn', oldName: this.editColumn, newName: this.renameTarget, desc: `重命名 ${this.editColumn} → ${this.renameTarget}` }
    },

    previewDeleteColumn() {
      if (!this.editColumn) return
      const result = deleteColumn(this.dataset.getRows(), this.editColumn)
      this.preview = { ...result, op: 'deleteColumn', column: this.editColumn }
    },

    // Advanced filter
    addFilterCondition() {
      this.filterConditions.push({ column: '', operator: 'equals', value: '' })
    },

    previewApplyFilter() {
      const valid = this.filterConditions.filter(c => c.column && c.operator)
      if (valid.length === 0) return
      const result = applyFilter(this.dataset.getRows(), valid, true)
      this.preview = { ...result, op: 'applyFilter', conditions: JSON.parse(JSON.stringify(valid)), desc: `筛选后保留 ${result.matched} 行` }
    }
  }
}
</script>