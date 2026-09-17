/**
 * Charts - ECharts chart configuration builders
 */

export function buildLineChart(xData, yData, xLabel, yLabel, title) {
  return {
    title: { text: title || `${yLabel} 趋势图`, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: xData, name: xLabel, axisLabel: { rotate: xData.length > 20 ? 45 : 0 } },
    yAxis: { type: 'value', name: yLabel },
    series: [{ data: yData, type: 'line', smooth: true, lineStyle: { width: 2 }, itemStyle: { color: '#4f8df5' } }]
  }
}

export function buildBarChart(xData, yData, xLabel, yLabel, title) {
  return {
    title: { text: title || `${xLabel} - ${yLabel}`, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: xData, name: xLabel, axisLabel: { rotate: xData.length > 10 ? 45 : 0 } },
    yAxis: { type: 'value', name: yLabel },
    series: [{ data: yData, type: 'bar', itemStyle: { color: '#4f8df5' }, barMaxWidth: 50 }]
  }
}

export function buildPieChart(data, title) {
  return {
    title: { text: title || '数据分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['30%', '60%'],
      center: ['50%', '55%'],
      data: data,
      label: { formatter: '{b}\n{d}%' }
    }]
  }
}

export function buildHistogram(values, title) {
  if (!values || values.length === 0) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const binCount = Math.min(Math.ceil(Math.sqrt(values.length)), 30)
  const binWidth = (max - min) / binCount || 1

  const bins = Array(binCount).fill(0)
  const labels = []

  for (let i = 0; i < binCount; i++) {
    const lo = min + i * binWidth
    const hi = lo + binWidth
    labels.push(lo.toFixed(1) + '-' + hi.toFixed(1))
  }

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1)
    bins[idx]++
  }

  return {
    title: { text: title || '数值分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: labels, axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'value', name: '频次' },
    series: [{ data: bins, type: 'bar', itemStyle: { color: '#4f8df5' }, barWidth: '90%' }]
  }
}

export function getChartTypeRecommendation(xCol, yCol) {
  if (!xCol || !yCol) return 'bar'

  if (xCol.type === 'date' && yCol.type === 'number') return 'line'
  if (xCol.type === 'number' && yCol.type === 'number') return 'scatter'
  if (xCol.type === 'string' && yCol.type === 'number') return 'bar'
  if (xCol.type === 'string' && yCol.type === 'string') return 'pie'
  if (xCol.type === 'date' && yCol.type === 'string') return 'bar'

  return 'bar'
}