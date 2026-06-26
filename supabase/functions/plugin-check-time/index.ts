import { getSupabaseClient, corsHeaders, jsonResponse } from '../_shared/supabase.ts'
import { getClientIp, checkRateLimit } from '../_shared/rate-limit.ts'
import { isValidCode, isValidFingerId } from '../_shared/validate.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || ''
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) })
  }

  // 速率限制
  const ip = getClientIp(req)
  const { allowed, remaining } = checkRateLimit(ip, 30)
  if (!allowed) {
    return jsonResponse({ status: false, msg: '请求过于频繁，请稍后再试' }, 429, origin)
  }

  try {
    const supabase = getSupabaseClient()
    const { fingerId, code } = await req.json()

    if (!fingerId || !code || !isValidCode(code) || !isValidFingerId(fingerId)) {
      await logAction(supabase, 'check', code, fingerId, req, 'failed', '参数不完整')
      return jsonResponse({ status: false, msg: '参数不完整' }, 200, origin)
    }

    // 查询激活码
    const { data: codeData, error: codeError } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('code', code)
      .single()

    if (codeError || !codeData) {
      await logAction(supabase, 'check', code, fingerId, req, 'failed', '激活码不存在')
      return jsonResponse({ status: false, msg: '激活码不存在' }, 200, origin)
    }

    // 检查激活码状态和过期（统一用码级 expire_at）
    const now = new Date()
    const isExpired = codeData.status !== 'active' || (codeData.expire_at && new Date(codeData.expire_at) < now)
    if (isExpired) {
      if (codeData.expire_at && new Date(codeData.expire_at) < now && codeData.status !== 'expired') {
        await supabase.from('activation_codes').update({ status: 'expired' }).eq('id', codeData.id)
      }
      await logAction(supabase, 'check', code, fingerId, req, 'failed', '激活码已失效')
      return jsonResponse({ status: false, msg: '激活码已失效' }, 200, origin)
    }

    // 查找激活记录
    const { data: deviceData } = await supabase
      .from('device_activations')
      .select('*')
      .eq('code_id', codeData.id)
      .eq('finger_id', fingerId)
      .single()

    if (!deviceData) {
      await logAction(supabase, 'check', code, fingerId, req, 'failed', '设备未激活')
      return jsonResponse({ status: false, msg: '设备未激活' }, 200, origin)
    }

    return jsonResponse({
      status: true,
      msg: '激活有效',
      data: codeData.expire_at || deviceData.expire_at
    }, 200, origin)
  } catch (error) {
    console.error('检查激活状态失败:', error)
    return jsonResponse({ status: false, msg: '检查失败' }, 500, origin)
  }
})

async function logAction(supabase: any, action: string, code: string, fingerId: string, req: Request, result: string, message: string) {
  try {
    await supabase.from('activation_logs').insert({
      action,
      code,
      finger_id: fingerId,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
      result,
      message
    })
  } catch (error) {
    console.error('记录日志失败:', error)
  }
}
