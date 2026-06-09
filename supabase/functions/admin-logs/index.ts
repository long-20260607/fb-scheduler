import { getSupabaseClient, corsHeaders, jsonResponse } from '../_shared/supabase.ts'

// 验证 JWT
async function verifyToken(token: string): Promise<any> {
  const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'fb-scheduler-secret-2024-xK9mP2vL'
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  try {
    const [header, payload, signature] = token.split('.')
    const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0))
    const data = encoder.encode(`${header}.${payload}`)

    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, data)
    if (!valid) return null

    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const supabase = getSupabaseClient()

    // 验证 token
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ status: false, msg: '未授权' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const payload = await verifyToken(token)
    if (!payload) {
      return jsonResponse({ status: false, msg: 'token 无效或已过期' }, 401)
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
    })
  } catch (error) {
    console.error('获取日志失败:', error)
    return jsonResponse({ status: false, msg: '获取失败: ' + error.message }, 500)
  }
})
