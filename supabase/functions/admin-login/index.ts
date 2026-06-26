import { getSupabaseClient, corsHeaders, jsonResponse } from '../_shared/supabase.ts'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.1/mod.ts'
import { getClientIp, checkRateLimit } from '../_shared/rate-limit.ts'
import { isValidUsername, isValidPassword } from '../_shared/validate.ts'

const JWT_SECRET = Deno.env.get('JWT_SECRET')
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set')
}

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
  const origin = req.headers.get('origin') || ''
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) })
  }

  // 速率限制（登录接口更严格，防暴力破解）
  const ip = getClientIp(req)
  const { allowed, remaining } = checkRateLimit(ip, 10)
  if (!allowed) {
    return jsonResponse({ status: false, msg: '请求过于频繁，请稍后再试' }, 429, origin)
  }

  try {
    const supabase = getSupabaseClient()
    const { username, password } = await req.json()

    if (!username || !password || !isValidUsername(username) || !isValidPassword(password)) {
      return jsonResponse({ status: false, msg: '请输入用户名和密码' }, 200, origin)
    }

    // 查询管理员
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .single()

    if (error || !admin) {
      return jsonResponse({ status: false, msg: '用户名或密码错误' }, 200, origin)
    }

    // 验证密码
    const isValid = await comparePassword(password, admin.password_hash)

    if (!isValid) {
      return jsonResponse({ status: false, msg: '用户名或密码错误' }, 200, origin)
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
    }, 200, origin)
  } catch (error) {
    console.error('登录失败:', error)
    return jsonResponse({ status: false, msg: '登录失败' }, 500, origin)
  }
})
