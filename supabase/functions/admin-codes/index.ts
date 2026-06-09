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

// 生成激活码
function genCode(prefix: string = ''): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return prefix + `${seg()}-${seg()}-${seg()}-${seg()}`
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
    const path = url.pathname.split('/').pop()

    // GET /admin-codes - 获取列表
    if (req.method === 'GET' && !path) {
      const page = parseInt(url.searchParams.get('page') || '1')
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20')
      const status = url.searchParams.get('status')
      const keyword = url.searchParams.get('keyword')

      let query = supabase
        .from('activation_codes')
        .select('*, device_activations!left(activated_at, expire_at, status)', { count: 'exact' })

      if (status) query = query.eq('status', status)
      if (keyword) query = query.ilike('code', `%${keyword}%`)

      query = query
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)

      const { data, count, error } = await query

      if (error) throw error

      // 处理数据，提取最新的激活时间和到期时间
      const list = (data || []).map(item => {
        const activeActivations = (item.device_activations || [])
          .filter((da: any) => da.status === 'active')
        const lastActivatedAt = activeActivations.length > 0
          ? activeActivations.reduce((max: string, da: any) =>
              da.activated_at > max ? da.activated_at : max, activeActivations[0].activated_at)
          : null
        const deviceExpireAt = activeActivations.length > 0
          ? activeActivations.reduce((max: string, da: any) =>
              (da.expire_at && da.expire_at > max) ? da.expire_at : max, activeActivations[0].expire_at || '')
          : null

        return {
          ...item,
          last_activated_at: lastActivatedAt,
          device_expire_at: deviceExpireAt || null,
          device_activations: undefined
        }
      })

      return jsonResponse({
        status: true,
        data: { list, total: count || 0, page, pageSize }
      })
    }

    // POST /admin-codes - 创建单个 / 批量创建 / 批量删除
    if (req.method === 'POST' && !path) {
      const body = await req.json()

      // 批量删除
      if (body._action === 'batch-delete' || body.ids) {
        const { ids } = body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return jsonResponse({ status: false, msg: '请选择要删除的激活码' })
        }

        if (ids.length > 100) {
          return jsonResponse({ status: false, msg: '单次最多删除 100 条' })
        }

        const { error, count } = await supabase
          .from('activation_codes')
          .delete({ count: 'exact' })
          .in('id', ids)

        if (error) throw error

        return jsonResponse({
          status: true,
          msg: `成功删除 ${count || ids.length} 个激活码`
        })
      }

      // 批量创建
      if (body._action === 'batch' || body.count > 1) {
        const { count = 1, prefix = '', duration_days = 30, max_devices = 1 } = body

        if (!count || count < 1 || count > 100) {
          return jsonResponse({ status: false, msg: '数量范围 1-100' })
        }

        const codes = []
        for (let i = 0; i < count; i++) {
          codes.push({ code: genCode(prefix), duration_days, max_devices })
        }

        const { data, error } = await supabase
          .from('activation_codes')
          .insert(codes)
          .select()

        if (error) throw error

        return jsonResponse({
          status: true,
          msg: `成功创建 ${count} 个激活码（激活后 ${duration_days} 天有效）`,
          data: { codes: data?.map(c => c.code), duration_days }
        })
      }

      // 单个创建
      const { code, duration_days = 30, max_devices = 1 } = body

      if (!code) {
        return jsonResponse({ status: false, msg: '请输入激活码' })
      }

      const { data: existing } = await supabase
        .from('activation_codes')
        .select('id')
        .eq('code', code)
        .single()

      if (existing) {
        return jsonResponse({ status: false, msg: '激活码已存在' })
      }

      const { data, error } = await supabase
        .from('activation_codes')
        .insert({ code, duration_days, max_devices })
        .select()
        .single()

      if (error) throw error

      return jsonResponse({ status: true, msg: '创建成功', data })
    }

    // POST /admin-codes/quick - 快速创建
    if (req.method === 'POST' && path === 'quick') {
      const { count = 1, max_devices = 1, duration_days = 30, prefix = '' } = await req.json()

      if (count < 1 || count > 100) {
        return jsonResponse({ status: false, msg: '数量范围 1-100' })
      }

      const codes = []
      for (let i = 0; i < count; i++) {
        codes.push({ code: genCode(prefix), duration_days, max_devices })
      }

      const { data, error } = await supabase
        .from('activation_codes')
        .insert(codes)
        .select()

      if (error) throw error

      return jsonResponse({
        status: true,
        msg: `成功创建 ${count} 个激活码（激活后 ${duration_days} 天有效）`,
        data: { codes: data?.map(c => c.code), duration_days, max_devices }
      })
    }

    // PUT /admin-codes/:id - 更新
    if (req.method === 'PUT') {
      const id = url.searchParams.get('id') || path
      const body = await req.json()
      const { status, duration_days, max_devices } = body

      const updateData: any = {}
      if (status !== undefined) updateData.status = status
      if (duration_days !== undefined) updateData.duration_days = duration_days
      if (max_devices !== undefined) updateData.max_devices = max_devices
      updateData.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('activation_codes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      if (!data) {
        return jsonResponse({ status: false, msg: '激活码不存在' })
      }

      return jsonResponse({ status: true, msg: '更新成功', data })
    }

    // DELETE /admin-codes/:id - 删除
    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id') || path

      const { data, error } = await supabase
        .from('activation_codes')
        .delete()
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      if (!data) {
        return jsonResponse({ status: false, msg: '激活码不存在' })
      }

      return jsonResponse({ status: true, msg: '删除成功' })
    }

    return jsonResponse({ status: false, msg: '未知操作' }, 400)
  } catch (error) {
    console.error('操作失败:', error)
    return jsonResponse({ status: false, msg: '操作失败: ' + error.message }, 500)
  }
})
