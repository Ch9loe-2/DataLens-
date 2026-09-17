/**
 * DataLens — 完整功能回归测试
 *
 * 测试所有数据处理核心逻辑（不依赖浏览器 UI）
 * 通过 Node.js 直接导入并测试 JS 模块
 */

import Papa from 'papaparse'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let passed = 0
let failed = 0

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}`)
    failed++
  }
}

// ─── 1. CSV 解析测试 ────────────────────────────
console.log('\n📂 CSV 解析测试:')

// 1a. 空 CSV（仅表头）
const emptyParsed = Papa.parse(fs.readFileSync(path.join(__dirname, 'empty_headers_only.csv'), 'utf-8'), { header: true, skipEmptyLines: true })
assert(emptyParsed.data.length === 0, '仅表头 CSV 解析为空数组')

// 1b. 正常 CSV
const normalParsed = Papa.parse(fs.readFileSync(path.join(__dirname, 'normal.csv'), 'utf-8'), { header: true, skipEmptyLines: true })
assert(normalParsed.data.length === 20, `正常 CSV 解析出 20 行 (实际 ${normalParsed.data.length})`)
assert(Object.keys(normalParsed.data[0]).length === 5, '正常 CSV 有 5 列')

// 1c. 边缘情况 CSV（中文、emoji、特殊字符）
const edgeParsed = Papa.parse(fs.readFileSync(path.join(__dirname, 'edge_cases.csv'), 'utf-8'), { header: true, skipEmptyLines: true })
assert(edgeParsed.data.length === 10, '边缘 CSV 解析出 10 行')
const rowWithEmoji = edgeParsed.data.find(r => r.id === '2')
assert(rowWithEmoji && rowWithEmoji.comment.includes('😊'), 'Emoji 正确保留')
const rowWithCN = edgeParsed.data.find(r => r.id === '6')
assert(rowWithCN && rowWithCN.name.includes('超长中文'), '中文数据正确解析')

// 1d. 缺失值 CSV
const missingParsed = Papa.parse(fs.readFileSync(path.join(__dirname, 'missing_and_duplicates.csv'), 'utf-8'), { header: true, skipEmptyLines: true })
assert(missingParsed.data.length === 22, '缺失值 CSV 解析出 22 行')

// 1e. 大 CSV 解析
const large10k = Papa.parse(fs.readFileSync(path.join(__dirname, 'large_10k.csv'), 'utf-8'), { header: true, skipEmptyLines: true })
assert(large10k.data.length === 10000, `10K CSV 解析出 10000 行 (实际 ${large10k.data.length})`)
assert(Object.keys(large10k.data[0]).length === 7, '10K CSV 有 7 列')

// ─── 2. 数据模型测试 ────────────────────────────
console.log('\n📦 数据模型测试:')

import Dataset from '../src/models/Dataset.js'
import Column from '../src/models/Column.js'

const ds = new Dataset()
ds.importData(normalParsed)
assert(ds.meta.rowCount === 20, `Dataset 行数 = 20 (实际 ${ds.meta.rowCount})`)
assert(ds.meta.columnCount === 5, 'Dataset 列数 = 5')
assert(ds.columns.length === 5, 'Dataset 有 5 个 Column 对象')

// 类型推断
const ageCol = ds.columns.find(c => c.name === '年龄')
assert(ageCol.type === 'number', '年龄列类型推断为 number')
const nameCol = ds.columns.find(c => c.name === '姓名')
assert(nameCol.type === 'string', '姓名列类型推断为 string')
const dateCol = ds.columns.find(c => c.name === '日期')
assert(dateCol.type === 'date', '日期列类型推断为 date')

// 统计值
assert(ageCol.statistics !== null, '数值列有统计信息')
assert(ageCol.statistics.min === 20, `年龄最小值 = 20 (实际 ${ageCol.statistics.min})`)
assert(ageCol.statistics.max === 23, `年龄最大值 = 23 (实际 ${ageCol.statistics.max})`)

// ─── 3. 分析引擎测试 ────────────────────────────
console.log('\n📊 分析引擎测试:')

import { runAnalysisSync } from '../src/analysis/index.js'

const report = runAnalysisSync(normalParsed.data)
assert(report !== null, '分析结果不为 null')
assert(report.totalRows === 20, `分析报告行数 = 20 (实际 ${report.totalRows})`)
assert(report.totalCols === 5, `分析报告列数 = 5 (实际 ${report.totalCols})`)
assert(report.totalMissing === 0, `正常 CSV 缺失值 = 0 (实际 ${report.totalMissing})`)
assert(report.duplicateRows === 0, `正常 CSV 重复行 = 0 (实际 ${report.duplicateRows})`)
assert(report.qualityScore === 100, `正常 CSV 质量分 = 100 (实际 ${report.qualityScore})`)
assert(report.qualityBreakdown.length === 0, `正常 CSV 无扣分项`)

// 含缺失值和重复的 CSV 分析
const badReport = runAnalysisSync(missingParsed.data)
assert(badReport !== null, '缺失 CSV 分析结果不为 null')
assert(badReport.totalRows === 22, `缺失 CSV 行数 = 22 (实际 ${badReport.totalRows})`)
assert(badReport.totalMissing > 0, `缺失 CSV 检测到缺失值 (${badReport.totalMissing})`)
assert(badReport.duplicateRows > 0, `缺失 CSV 检测到重复行 (${badReport.duplicateRows})`)
assert(badReport.qualityScore < 100, `缺失 CSV 质量分 < 100 (实际 ${badReport.qualityScore})`)
assert(badReport.qualityBreakdown.length > 0, '缺失 CSV 有扣分项')

// 大 CSV 分析
const largeReport = runAnalysisSync(large10k.data)
assert(largeReport.totalRows === 10000, '大 CSV 分析行数正确')
assert(largeReport.qualityScore > 0, '大 CSV 有合理质量分')

// ─── 4. 清洗引擎测试 ────────────────────────────
console.log('\n🧹 清洗引擎测试:')

import { 
  removeDuplicates,
  removeRowsWithMissing,
  fillMissingNumeric,
  fillMissingString,
  convertType 
} from '../src/cleaning/index.js'

// 4a. 去重
const dupResult = removeDuplicates(missingParsed.data)
assert(dupResult.removed === 2, `去重移除 2 行 (实际 ${dupResult.removed})`)
assert(dupResult.rows.length === 20, `去重后 20 行 (实际 ${dupResult.rows.length})`)

// 4b. 删除缺失行
const missingCols = ['分数', '城市']
const rmResult = removeRowsWithMissing(missingParsed.data, ['城市'])
assert(rmResult.removed > 0, '删除城市列缺失行')
assert(rmResult.rows.length + rmResult.removed === missingParsed.data.length, '删除+剩余=总数')

// 4c. 均值填充
const fillResult = fillMissingNumeric(missingParsed.data, '年龄', 'mean')
assert(fillResult.filled > 0, `均值填充了 ${fillResult.filled} 个值`)
assert(fillResult.fillValue > 0, '填充值 > 0')

// 4d. 字符串填充
const strFill = fillMissingString(missingParsed.data, '城市')
assert(strFill.filled > 0, `字符串填充了 ${strFill.filled} 个值`)

// 4e. 类型转换
const convertResult = convertType(missingParsed.data, '年龄', 'number')
assert(convertResult.converted > 0, `类型转换 ${convertResult.converted} 个值`)

// 检查转换后仍然是字符串表示（因为 currentRows 存的是字符串）
const invalidData = Papa.parse(fs.readFileSync(path.join(__dirname, 'invalid_data.csv'), 'utf-8'), { header: true, skipEmptyLines: true })
const convResult = convertType(invalidData.data, 'score', 'number')
assert(convResult.failed > 0, '无效数字转换失败 > 0')

// ─── 5. Undo 测试 ────────────────────────────────
console.log('\n↩️ Undo 测试:')

const undoTs = new Dataset()
undoTs.importData(normalParsed)
assert(!undoTs.canUndo(), '新建 Dataset 不可撤销')

// 模拟去重操作
const dupRes = removeDuplicates(undoTs.getRows())
undoTs.saveSnapshot('removeDuplicates')
undoTs.currentRows = dupRes.rows
assert(undoTs.canUndo(), '操作后可撤销')

// 撤销
const preUndoRows = undoTs.currentRows.length
const ok = undoTs.undo()
assert(ok, '撤销成功')
assert(undoTs.currentRows.length === normalParsed.data.length, '撤销后行数恢复原始')

// 连续两次操作后撤销
const dupRes2 = removeDuplicates(undoTs.getRows())
undoTs.saveSnapshot('removeDuplicates2')
undoTs.currentRows = dupRes2.rows
const fillRes2 = fillMissingNumeric(undoTs.getRows(), '年龄', 'mean')
undoTs.saveSnapshot('fillMissing')
undoTs.currentRows = fillRes2.rows

assert(undoTs.canUndo(), '两次操作后可撤销')
assert(undoTs.undo(), '第一次撤销成功')
assert(undoTs.currentRows.length === dupRes2.rows.length, '撤销回到去重后行数')
assert(undoTs.undo(), '第二次撤销成功')
assert(undoTs.currentRows.length === normalParsed.data.length, '撤销回到初始行数')

// ─── 6. 图表模块测试 ────────────────────────────
console.log('\n📈 图表模块测试:')

import { buildLineChart, buildBarChart, buildPieChart, buildHistogram, getChartTypeRecommendation } from '../src/charts/index.js'

const lineOpts = buildLineChart(['a','b','c'], [1,2,3], 'X', 'Y', 'Test')
assert(lineOpts.xAxis.data.length === 3, '折线图 X 轴数据正确')
assert(lineOpts.series[0].type === 'line', '折线图 series type = line')

const barOpts = buildBarChart(['a','b'], [5,10], 'X', 'Y')
assert(barOpts.series[0].type === 'bar', '柱状图 series type = bar')

const pieOpts = buildPieChart([{name:'A',value:10},{name:'B',value:20}])
assert(pieOpts.series[0].type === 'pie', '饼图 series type = pie')

const histData = [1,2,2,3,3,3,4,4,5]
const histOpts = buildHistogram(histData, '分布')
assert(histOpts !== null, '分布图生成成功')

// 图表推荐
const dateColType = { type: 'date', name: 'd' }
const numColType = { type: 'number', name: 'n' }
const strColType = { type: 'string', name: 's' }
assert(getChartTypeRecommendation(dateColType, numColType) === 'line', '日期+数字 → 折线图')
assert(getChartTypeRecommendation(strColType, numColType) === 'bar', '字符串+数字 → 柱状图')

// ─── 7. 边界测试 ────────────────────────────────
console.log('\n🔲 边界测试:')

// 零行数据
const emptyResult = runAnalysisSync([])
assert(emptyResult === null, '空数组分析返回 null')

// 单行 CSV
const singleRow = Papa.parse('a,b\n1,2', { header: true })
const singleReport = runAnalysisSync(singleRow.data)
assert(singleReport.totalRows === 1, '单行分析正确')

// 全为空值的列
const allNull = Papa.parse('a,b\n,', { header: true })
const nullReport = runAnalysisSync(allNull.data)
assert(nullReport.totalMissing > 0, '全空值列检测到缺失')

// 大量重复
const manyDup = Array(100).fill({ id: '1', name: 'x' })
const dupReport = runAnalysisSync(manyDup)
assert(dupReport.duplicateRows === 99, `大量重复中检测到 ${dupReport.duplicateRows} 行重复`)

// ─── 8. Storage 测试 ────────────────────────────
console.log('\n💾 Storage 测试 (IndexedDB — Node.js 跳过):')
console.log('  ⏭️  IndexedDB 依赖浏览器环境，Node.js 无法测试')

// ─── 结果 ────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`)
console.log(`总测试: ${passed + failed}  通过: ${passed}  失败: ${failed}`)
console.log(`${'='.repeat(50)}`)

process.exit(failed > 0 ? 1 : 0)