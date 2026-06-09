import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'

// Supabase Edge Functions 配置
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hizynzkovnnugjedqpuw.supabase.co'
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`

// 根据环境选择 API 基础地址
const isDev = import.meta.env.DEV
const baseURL = isDev ? '/api' : FUNCTIONS_BASE

const api = axios.create({
  baseURL,
  timeout: 15000
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (!isDev) {
      config.headers.apikey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    }
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
export const login = (data) => api.post(isDev ? '/admin/login' : '/admin-login', data)

// 激活码管理
export const getCodes = (params) => api.get(isDev ? '/admin/codes' : '/admin-codes', { params })
export const createCode = (data) => api.post(isDev ? '/admin/codes' : '/admin-codes', data)
export const batchCreateCodes = (data) => api.post(isDev ? '/admin/codes/batch' : '/admin-codes', { ...data, _action: 'batch' })
export const updateCode = (id, data) => {
  if (isDev) {
    return api.put(`/admin/codes/${id}`, data)
  }
  return api.put(`/admin-codes?id=${id}`, data)
}
export const deleteCode = (id) => {
  if (isDev) {
    return api.delete(`/admin/codes/${id}`)
  }
  return api.delete(`/admin-codes?id=${id}`)
}
export const batchDeleteCodes = (ids) => api.post(isDev ? '/admin/codes/batch-delete' : '/admin-codes', { ids, _action: 'batch-delete' })

// 统计数据
export const getStats = () => api.get(isDev ? '/admin/stats' : '/admin-stats')

// 操作日志
export const getLogs = (params) => api.get(isDev ? '/admin/logs' : '/admin-logs', { params })

export default api
