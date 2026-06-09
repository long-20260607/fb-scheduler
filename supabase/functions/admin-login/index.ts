import { getSupabaseClient, corsHeaders, jsonResponse } from '../_shared/supabase.ts'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.1/mod.ts'

const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'fb-scheduler-secret-2024-xK9mP2vL'

async function getKey() {
  const encoder = new TextEncoder()
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

// 简单的密码哈希比较（使用 Web Crypto API）
async function comparePassword(password: string, hash: string): Promise<boolean> {
  // bcrypt 格式的 hash 无法用 Web Crypto 直接验证
  // 这里使用 Supabase 的 RPC 函数来验证密码
  const supabase = getSupabaseClient()
  const { data } = await supabase.rpc('verify_password', {
    password,
    hash
  })
  return data === true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const supabase = getSupabaseClient()
    const { username, password } = await req.json()

    if (!username || !password) {
      return jsonResponse({ status: false, msg: '请输入用户名和密码' })
    }

    // 查询管理员
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .single()

    if (error || !admin) {
      return jsonResponse({ status: false, msg: '用户名或密码错误' })
    }

    // 验证密码
    const isValid = await comparePassword(password, admin.password_hash)

    if (!isValid) {
      return jsonResponse({ status: false, msg: '用户名或密码错误' })
    }

    // 生成 JWT
    const key = await getKey()
    const token = await create(
      { alg: 'HS256', typ: 'JWT' },
      { id: admin.id, username: admin.username, exp: getNumericDate(60 * 60 * 24) },
      key
    )

    return jsonResponse({
      status: true,
      msg: '登录成功',
      data: { token, username: admin.username }
    })
  } catch (error) {
    console.error('登录失败:', error)
    return jsonResponse({ status: false, msg: '登录失败: ' + error.message }, 500)
  }
})
