import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'

// Supabase Edge Functions 配置
// 本地开发走 Vite 代理（相对路径），线上走正式域名
const FUNCTIONS_BASE = import.meta.env.DEV
  ? '/functions/v1'
  : `${import.meta.env.VITE_SUPABASE_URL || 'https://hizynzkovnnugjedqpuw.supabase.co'}/functions/v1`

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

// 激活码管理（scope 可选：传 'collector' 走采集插件表，不传 = 原表）
const scopeQs = (scope) => (scope ? `?scope=${encodeURIComponent(scope)}` : '')

export const getCodes = (params) => api.get('/admin-codes', { params })
export const createCode = (data, scope) => api.post(`/admin-codes${scopeQs(scope)}`, data)
export const batchCreateCodes = (data, scope) => api.post(`/admin-codes${scopeQs(scope)}`, { ...data, _action: 'batch' })
export const updateCode = (id, data, scope) => api.put(`/admin-codes?id=${id}${scope ? `&scope=${encodeURIComponent(scope)}` : ''}`, data)
export const deleteCode = (id, scope) => api.delete(`/admin-codes?id=${id}${scope ? `&scope=${encodeURIComponent(scope)}` : ''}`)
export const batchDeleteCodes = (ids, scope) => api.post(`/admin-codes${scopeQs(scope)}`, { ids, _action: 'batch-delete' })
export const renewCode = (id, add_days, scope) => api.post(`/admin-codes${scopeQs(scope)}`, { id, add_days, _action: 'renew' })
export const clearDevices = (id, scope) => api.post(`/admin-codes${scopeQs(scope)}`, { id, _action: 'clear-devices' })

// 统计数据
export const getStats = () => api.get('/admin-stats')

// 操作日志
export const getLogs = (params) => api.get('/admin-logs', { params })

export default api
