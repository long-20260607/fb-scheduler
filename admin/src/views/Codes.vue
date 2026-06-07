<template>
  <div class="codes-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索激活码"
              style="width: 200px"
              clearable
              @clear="fetchCodes"
              @keyup.enter="fetchCodes"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>

            <el-select
              v-model="searchStatus"
              placeholder="状态筛选"
              style="width: 120px; margin-left: 10px"
              clearable
              @change="fetchCodes"
            >
              <el-option label="有效" value="active" />
              <el-option label="禁用" value="disabled" />
              <el-option label="过期" value="expired" />
            </el-select>
          </div>

          <div class="header-right">
            <el-button type="primary" @click="showBatchDialog = true">
              <el-icon><Plus /></el-icon>
              批量创建
            </el-button>
            <el-button @click="showCreateDialog = true">
              <el-icon><Plus /></el-icon>
              单个创建
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="codes" v-loading="loading" border stripe>
        <el-table-column prop="code" label="激活码" min-width="200" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="max_devices" label="最大设备数" width="120" />
        <el-table-column prop="expire_at" label="过期时间" width="180">
          <template #default="{ row }">
            {{ row.expire_at ? formatDate(row.expire_at) : '永不过期' }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button
              size="small"
              :type="row.status === 'active' ? 'warning' : 'success'"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 'active' ? '禁用' : '启用' }}
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchCodes"
          @current-change="fetchCodes"
        />
      </div>
    </el-card>

    <!-- 创建激活码对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建激活码" width="500px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="激活码" prop="code">
          <el-input v-model="createForm.code" placeholder="请输入激活码">
            <template #append>
              <el-button @click="generateCode">自动生成</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="最大设备数" prop="max_devices">
          <el-input-number v-model="createForm.max_devices" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker
            v-model="createForm.expire_at"
            type="datetime"
            placeholder="选择过期时间（留空为永不过期）"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量创建对话框 -->
    <el-dialog v-model="showBatchDialog" title="批量创建激活码" width="500px">
      <el-form ref="batchFormRef" :model="batchForm" :rules="batchRules" label-width="100px">
        <el-form-item label="数量" prop="count">
          <el-input-number v-model="batchForm.count" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="前缀">
          <el-input v-model="batchForm.prefix" placeholder="可选，如 VIP-" />
        </el-form-item>
        <el-form-item label="最大设备数" prop="max_devices">
          <el-input-number v-model="batchForm.max_devices" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker
            v-model="batchForm.expire_at"
            type="datetime"
            placeholder="选择过期时间（留空为永不过期）"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBatchDialog = false">取消</el-button>
        <el-button type="primary" @click="handleBatchCreate" :loading="creating">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑激活码" width="500px">
      <el-form ref="editFormRef" :model="editForm" label-width="100px">
        <el-form-item label="激活码">
          <el-input :value="editForm.code" disabled />
        </el-form-item>
        <el-form-item label="最大设备数">
          <el-input-number v-model="editForm.max_devices" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker
            v-model="editForm.expire_at"
            type="datetime"
            placeholder="选择过期时间（留空为永不过期）"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdate" :loading="updating">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import { getCodes, createCode, batchCreateCodes, updateCode, deleteCode } from '../api'

const loading = ref(false)
const creating = ref(false)
const updating = ref(false)
const codes = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const searchKeyword = ref('')
const searchStatus = ref('')

const showCreateDialog = ref(false)
const showBatchDialog = ref(false)
const showEditDialog = ref(false)

const createFormRef = ref(null)
const batchFormRef = ref(null)
const editFormRef = ref(null)

const createForm = reactive({
  code: '',
  max_devices: 1,
  expire_at: null
})

const batchForm = reactive({
  count: 10,
  prefix: '',
  max_devices: 1,
  expire_at: null
})

const editForm = reactive({
  id: '',
  code: '',
  max_devices: 1,
  expire_at: null
})

const createRules = {
  code: [{ required: true, message: '请输入激活码', trigger: 'blur' }]
}

const batchRules = {
  count: [{ required: true, message: '请输入数量', trigger: 'blur' }]
}

const getStatusType = (status) => {
  const map = {
    active: 'success',
    disabled: 'warning',
    expired: 'info'
  }
  return map[status] || 'info'
}

const getStatusLabel = (status) => {
  const map = {
    active: '有效',
    disabled: '禁用',
    expired: '过期'
  }
  return map[status] || status
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 20; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  createForm.code = code
}

const fetchCodes = async () => {
  loading.value = true
  try {
    const res = await getCodes({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value,
      status: searchStatus.value
    })
    if (res.status) {
      codes.value = res.data.list
      total.value = res.data.total
    }
  } catch (error) {
    console.error('获取激活码列表失败:', error)
  } finally {
    loading.value = false
  }
}

const handleCreate = async () => {
  if (!createFormRef.value) return

  await createFormRef.value.validate(async (valid) => {
    if (!valid) return

    creating.value = true
    try {
      const res = await createCode(createForm)
      if (res.status) {
        ElMessage.success('创建成功')
        showCreateDialog.value = false
        createForm.code = ''
        createForm.expire_at = null
        fetchCodes()
      }
    } catch (error) {
      console.error('创建失败:', error)
    } finally {
      creating.value = false
    }
  })
}

const handleBatchCreate = async () => {
  if (!batchFormRef.value) return

  await batchFormRef.value.validate(async (valid) => {
    if (!valid) return

    creating.value = true
    try {
      const res = await batchCreateCodes(batchForm)
      if (res.status) {
        ElMessage.success(res.msg)
        showBatchDialog.value = false
        fetchCodes()
      }
    } catch (error) {
      console.error('批量创建失败:', error)
    } finally {
      creating.value = false
    }
  })
}

const handleEdit = (row) => {
  editForm.id = row.id
  editForm.code = row.code
  editForm.max_devices = row.max_devices
  editForm.expire_at = row.expire_at
  showEditDialog.value = true
}

const handleUpdate = async () => {
  updating.value = true
  try {
    const res = await updateCode(editForm.id, {
      max_devices: editForm.max_devices,
      expire_at: editForm.expire_at
    })
    if (res.status) {
      ElMessage.success('更新成功')
      showEditDialog.value = false
      fetchCodes()
    }
  } catch (error) {
    console.error('更新失败:', error)
  } finally {
    updating.value = false
  }
}

const handleToggleStatus = async (row) => {
  const newStatus = row.status === 'active' ? 'disabled' : 'active'
  const action = newStatus === 'active' ? '启用' : '禁用'

  try {
    await ElMessageBox.confirm(`确定要${action}该激活码吗？`, '提示', {
      type: 'warning'
    })

    const res = await updateCode(row.id, { status: newStatus })
    if (res.status) {
      ElMessage.success(`${action}成功`)
      fetchCodes()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error(`${action}失败:`, error)
    }
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该激活码吗？删除后不可恢复。', '警告', {
      type: 'error'
    })

    const res = await deleteCode(row.id)
    if (res.status) {
      ElMessage.success('删除成功')
      fetchCodes()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

onMounted(() => {
  fetchCodes()
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
