import { getSupabaseClient, corsHeaders, jsonResponse } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const supabase = getSupabaseClient()
    const { fingerId, code } = await req.json()

    if (!fingerId || !code) {
      await logAction(supabase, 'activate', code, fingerId, req, 'failed', '参数不完整')
      return jsonResponse({ status: false, msg: '参数不完整' })
    }

    // 查询激活码
    const { data: codeData, error: codeError } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('code', code)
      .single()

    if (codeError || !codeData) {
      await logAction(supabase, 'activate', code, fingerId, req, 'failed', '激活码不存在')
      return jsonResponse({ status: false, msg: '激活码不存在' })
    }

    // 检查激活码状态
    if (codeData.status === 'disabled') {
      await logAction(supabase, 'activate', code, fingerId, req, 'failed', '激活码已禁用')
      return jsonResponse({ status: false, msg: '激活码已禁用' })
    }

    if (codeData.status === 'expired') {
      await logAction(supabase, 'activate', code, fingerId, req, 'failed', '激活码已过期')
      return jsonResponse({ status: false, msg: '激活码已过期' })
    }

    // 检查激活码是否超过激活截止时间
    if (codeData.expire_at && new Date(codeData.expire_at) < new Date()) {
      await supabase.from('activation_codes').update({ status: 'expired' }).eq('id', codeData.id)
      await logAction(supabase, 'activate', code, fingerId, req, 'failed', '激活码已过期')
      return jsonResponse({ status: false, msg: '激活码已过期' })
    }

    // 查询当前激活码的所有活跃设备
    const { data: activeDevices } = await supabase
      .from('device_activations')
      .select('*')
      .eq('code_id', codeData.id)
      .eq('status', 'active')

    const devices = activeDevices || []
    const existingActivation = devices.find(d => d.finger_id === fingerId)

    if (existingActivation) {
      // 已激活，直接返回
      return jsonResponse({
        status: true,
        msg: '设备已激活',
        data: existingActivation.expire_at
      })
    }

    // 检查设备数量限制
    if (devices.length >= codeData.max_devices) {
      await logAction(supabase, 'activate', code, fingerId, req, 'failed', '已达到最大设备数限制')
      return jsonResponse({ status: false, msg: '已达到最大设备数限制' })
    }

    // 计算设备过期时间：以激活时间为起点 + duration_days
    const durationDays = codeData.duration_days || 30
    const now = new Date()
    const deviceExpireAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

    // 创建新的激活记录
    await supabase.from('device_activations').insert({
      code_id: codeData.id,
      finger_id: fingerId,
      status: 'active',
      expire_at: deviceExpireAt.toISOString()
    })

    await logAction(supabase, 'activate', code, fingerId, req, 'success', '激活成功')

    return jsonResponse({
      status: true,
      msg: '激活成功',
      data: deviceExpireAt.toISOString()
    })
  } catch (error) {
    console.error('激活失败:', error)
    return jsonResponse({ status: false, msg: '激活失败: ' + error.message }, 500)
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
