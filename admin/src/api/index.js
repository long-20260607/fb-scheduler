import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'

// 统一走同源 /api：线上由 Cloudflare Pages 的 _worker.js 反代到 Supabase，
// 本地由 vite.config.js 的 /api 代理转发。浏览器不再直连 *.supabase.co。
const FUNCTIONS_BASE = '/api'

const api = axios.create({
  baseURL: FUNCTIONS_BASE,
  timeout: 20000
})

// 只对「没收到响应 / 5xx」且为 GET 的幂等请求重试，避免写操作重复提交
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 500

const isRetryable = (error) => {
  const config = error.config
  if (!config || config.method !== 'get') return false
  if (!error.response) return true
  return error.response.status >= 500
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function describeError(error) {
  if (error.response) {
    const status = error.response.status
    if (status >= 500) return `服务暂时不可用（HTTP ${status}），请稍后重试`
    if (status === 404) return '接口不存在，请确认代理已部署'
    return `请求失败（HTTP ${status}）`
  }
  if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
    return '连接授权服务超时，请检查网络后重试'
  }
  // axios 的 Network Error 表示完全没收到 HTTP 响应：
  // 常见于跨域失败、TLS/连接被重置、断网，不等于服务端返回错误
  return '无法连接授权服务，请检查网络或代理设置后重试'
}

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // 没注入 anon key 时不要发空头，空值可能被网关拒绝
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (anonKey) {
      config.headers.apikey = anonKey
    }
    return config
  },
  (error) => Promise.reject(error)
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
  async (error) => {
    const config = error.config
    if (config && isRetryable(error)) {
      config.__retryCount = config.__retryCount || 0
      if (config.__retryCount < MAX_RETRIES) {
        config.__retryCount += 1
        await sleep(RETRY_DELAY_MS * config.__retryCount)
        return api.request(config)
      }
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
      ElMessage.error('登录已过期，请重新登录')
    } else {
      ElMessage.error(describeError(error))
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
