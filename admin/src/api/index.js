import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'

// Supabase Edge Functions 配置
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hizynzkovnnugjedqpuw.supabase.co'
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`

const api = axios.create({
  baseURL: FUNCTIONS_BASE,
  timeout: 15000
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    config.headers.apikey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    const data = response.data

    if (data.status === false) {
      ElMessage.error(data.msg || '请求失败')
    }

    return data
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
      ElMessage.error('登录已过期，请重新登录')
    } else {
      ElMessage.error(error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

// 管理员登录
export const login = (data) => api.post('/admin-login', data)

// 激活码管理
export const getCodes = (params) => api.get('/admin-codes', { params })
export const createCode = (data) => api.post('/admin-codes', data)
export const batchCreateCodes = (data) => api.post('/admin-codes', { ...data, _action: 'batch' })
export const updateCode = (id, data) => api.put(`/admin-codes?id=${id}`, data)
export const deleteCode = (id) => api.delete(`/admin-codes?id=${id}`)
export const batchDeleteCodes = (ids) => api.post('/admin-codes', { ids, _action: 'batch-delete' })

// 统计数据
export const getStats = () => api.get('/admin-stats')

// 操作日志
export const getLogs = (params) => api.get('/admin-logs', { params })

export default api
