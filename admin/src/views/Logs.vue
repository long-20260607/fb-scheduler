<template>
  <div class="logs-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索激活码或设备ID"
              style="width: 200px"
              clearable
              @clear="fetchLogs"
              @keyup.enter="fetchLogs"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>

            <el-select
              v-model="searchAction"
              placeholder="操作类型"
              style="width: 120px; margin-left: 10px"
              clearable
              @change="fetchLogs"
            >
              <el-option label="激活" value="activate" />
              <el-option label="取消激活" value="deactivate" />
              <el-option label="检查" value="check" />
            </el-select>

            <el-select
              v-model="searchResult"
              placeholder="结果"
              style="width: 120px; margin-left: 10px"
              clearable
              @change="fetchLogs"
            >
              <el-option label="成功" value="success" />
              <el-option label="失败" value="failed" />
            </el-select>
          </div>
        </div>
      </template>

      <el-table :data="logs" v-loading="loading" border stripe>
        <el-table-column prop="action" label="操作" width="120">
          <template #default="{ row }">
            <el-tag :type="getActionType(row.action)">
              {{ getActionLabel(row.action) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="result" label="结果" width="100">
          <template #default="{ row }">
            <el-tag :type="row.result === 'success' ? 'success' : 'danger'">
              {{ row.result === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="激活码" width="200" show-overflow-tooltip />
        <el-table-column prop="finger_id" label="设备指纹" width="180" show-overflow-tooltip />
        <el-table-column prop="message" label="详情" min-width="200" show-overflow-tooltip />
        <el-table-column prop="ip_address" label="IP 地址" width="140" />
        <el-table-column prop="created_at" label="时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[50, 100, 200]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchLogs"
          @current-change="fetchLogs"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { getLogs } from '../api'

const loading = ref(false)
const logs = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(50)
const searchKeyword = ref('')
const searchAction = ref('')
const searchResult = ref('')

const getActionType = (action) => {
  const map = {
    activate: 'primary',
    deactivate: 'warning',
    check: 'info'
  }
  return map[action] || 'info'
}

const getActionLabel = (action) => {
  const map = {
    activate: '激活',
    deactivate: '取消激活',
    check: '检查'
  }
  return map[action] || action
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const fetchLogs = async () => {
  loading.value = true
  try {
    const res = await getLogs({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value,
      action: searchAction.value,
      result: searchResult.value
    })
    if (res.status) {
      logs.value = res.data.list
      total.value = res.data.total
    }
  } catch (error) {
    console.error('获取日志失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchLogs()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
