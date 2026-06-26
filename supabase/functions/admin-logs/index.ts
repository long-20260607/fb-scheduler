import { getSupabaseClient, corsHeaders, jsonResponse, verifyToken } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || ''
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) })
  }

  try {
    const supabase = getSupabaseClient()

    // 验证 token
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ status: false, msg: '未授权' }, 401, origin)
    }

    const token = authHeader.replace('Bearer ', '')
    const payload = await verifyToken(token)
    if (!payload) {
      return jsonResponse({ status: false, msg: 'token 无效或已过期' }, 401, origin)
    }

    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50')
    const action = url.searchParams.get('action')
    const result = url.searchParams.get('result')
    const keyword = url.searchParams.get('keyword')

    let query = supabase
      .from('activation_logs')
      .select('*', { count: 'exact' })

    if (action) query = query.eq('action', action)
    if (result) query = query.eq('result', result)
    if (keyword) {
      query = query.or(`code.ilike.%${keyword}%,finger_id.ilike.%${keyword}%`)
    }

    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    const { data, count, error } = await query

    if (error) throw error

    return jsonResponse({
      status: true,
      data: {
        list: data || [],
        total: count || 0,
        page,
        pageSize
      }
    }, 200, origin)
  } catch (error) {
    console.error('获取日志失败:', error)
    return jsonResponse({ status: false, msg: '获取失败' }, 500, origin)
  }
})
