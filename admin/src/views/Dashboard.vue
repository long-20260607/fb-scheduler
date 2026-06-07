<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stat-cards">
      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>激活码总数</span>
              <el-icon><Key /></el-icon>
            </div>
          </template>
          <div class="stat-value">{{ stats.totalCodes }}</div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>有效激活码</span>
              <el-icon><CircleCheck /></el-icon>
            </div>
          </template>
          <div class="stat-value success">{{ stats.activeCodes }}</div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>激活设备数</span>
              <el-icon><Monitor /></el-icon>
            </div>
          </template>
          <div class="stat-value primary">{{ stats.activeDevices }}</div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>今日激活</span>
              <el-icon><TrendCharts /></el-icon>
            </div>
          </template>
          <div class="stat-value warning">{{ stats.todayActivations }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card>
          <template #header>
            <span>近 7 天激活趋势</span>
          </template>
          <div ref="chartRef" style="height: 300px"></div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <span>快捷操作</span>
          </template>
          <div class="quick-actions">
            <el-button type="primary" @click="$router.push('/codes')">
              <el-icon><Plus /></el-icon>
              创建激活码
            </el-button>
            <el-button @click="$router.push('/logs')">
              <el-icon><Document /></el-icon>
              查看日志
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { Key, CircleCheck, Monitor, TrendCharts, Plus, Document } from '@element-plus/icons-vue'
import { getStats } from '../api'

const chartRef = ref(null)
const stats = ref({
  totalCodes: 0,
  activeCodes: 0,
  activeDevices: 0,
  todayActivations: 0,
  trend: []
})

const initChart = () => {
  if (!chartRef.value) return

  const chart = echarts.init(chartRef.value)
  const dates = stats.value.trend.map(item => item.date)
  const counts = stats.value.trend.map(item => item.count)

  const option = {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: dates
    },
    yAxis: {
      type: 'value',
      minInterval: 1
    },
    series: [{
      data: counts,
      type: 'line',
      smooth: true,
      areaStyle: {
        opacity: 0.3
      },
      itemStyle: {
        color: '#409eff'
      }
    }]
  }

  chart.setOption(option)

  window.addEventListener('resize', () => {
    chart.resize()
  })
}

const fetchStats = async () => {
  try {
    const res = await getStats()
    if (res.status) {
      stats.value = res.data
      await nextTick()
      initChart()
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

onMounted(() => {
  fetchStats()
})
</script>

<style scoped>
.stat-cards .el-card {
  cursor: pointer;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #303133;
  text-align: center;
}

.stat-value.success {
  color: #67c23a;
}

.stat-value.primary {
  color: #409eff;
}

.stat-value.warning {
  color: #e6a23c;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-actions .el-button {
  width: 100%;
}
</style>
