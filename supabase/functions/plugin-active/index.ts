import { getSupabaseClient, corsHeaders, jsonResponse } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || ''
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) })
  }

  try {
    const supabase = getSupabaseClient()
    const { fingerId, code } = await req.json()

    if (!fingerId || !code) {
      await logAction(supabase, 'activate', code, fingerId, req, 'failed', '参数不完整')
      return jsonResponse({ status: false, msg: '参数不完整' }, 200, origin)
    }

    // 查询激活码
    const { data: codeData, error: codeError } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('code', code)
      .single()

    if (codeError || !codeData) {
      await logAction(supabase, 'activate', code, fingerId, req, 'failed', '激活码不存在')
      return jsonResponse({ status: false, msg: '激活码不存在' }, 200, origin)
    }

    // 检查激活码状态
    if (codeData.status === 'disabled') {
      await logAction(supabase, 'activate', code, fingerId, req, 'failed', '激活码已禁用')
      return jsonResponse({ status: false, msg: '激活码已禁用' }, 200, origin)
    }

    // 检查激活码是否过期（status 或 expire_at 任一判定过期都拦截）
    const now = new Date()
    const isExpired = codeData.status === 'expired' || (codeData.expire_at && new Date(codeData.expire_at) < now)
    if (isExpired) {
      if (codeData.status !== 'expired') {
        await supabase.from('activation_codes').update({ status: 'expired' }).eq('id', codeData.id)
      }
      await logAction(supabase, 'activate', code, fingerId, req, 'failed', '激活码已过期')
      return jsonResponse({ status: false, msg: '激活码已过期' }, 200, origin)
    }

    // 查询当前激活码的所有设备
    const { data: activeDevices } = await supabase
      .from('device_activations')
      .select('*')
      .eq('code_id', codeData.id)

    const devices = activeDevices || []
    const existingActivation = devices.find(d => d.finger_id === fingerId)

    if (existingActivation) {
      return jsonResponse({
        status: true,
        msg: '设备已激活',
        data: codeData.expire_at || existingActivation.expire_at
      }, 200, origin)
    }

    // 检查设备数量限制
    if (devices.length >= codeData.max_devices) {
      await logAction(supabase, 'activate', code, fingerId, req, 'failed', '已达到最大设备数限制')
      return jsonResponse({ status: false, msg: '已达到最大设备数限制' }, 200, origin)
    }

    // 计算到期时间：首次激活时设置码级 expire_at，后续设备共享
    const durationDays = codeData.duration_days || 30
    let expireAt = codeData.expire_at

    if (!expireAt) {
      // 首次激活，设置码级到期时间
      expireAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()
      await supabase
        .from('activation_codes')
        .update({ expire_at: expireAt, status: 'active' })
        .eq('id', codeData.id)
    }

    // 创建设备激活记录
    await supabase.from('device_activations').insert({
      code_id: codeData.id,
      finger_id: fingerId
    })

    await logAction(supabase, 'activate', code, fingerId, req, 'success', '激活成功')

    return jsonResponse({
      status: true,
      msg: '激活成功',
      data: expireAt
    }, 200, origin)
  } catch (error) {
    console.error('激活失败:', error)
    return jsonResponse({ status: false, msg: '激活失败' }, 500, origin)
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
