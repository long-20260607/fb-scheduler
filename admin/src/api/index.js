import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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
export const login = (data) => api.post('/admin/login', data)

// 激活码管理
export const getCodes = (params) => api.get('/admin/codes', { params })
export const createCode = (data) => api.post('/admin/codes', data)
export const batchCreateCodes = (data) => api.post('/admin/codes/batch', data)
export const updateCode = (id, data) => api.put(`/admin/codes/${id}`, data)
export const deleteCode = (id) => api.delete(`/admin/codes/${id}`)
export const batchDeleteCodes = (ids) => api.post('/admin/codes/batch-delete', { ids })

// 统计数据
export const getStats = () => api.get('/admin/stats')

// 操作日志
export const getLogs = (params) => api.get('/admin/logs', { params })

export default api
