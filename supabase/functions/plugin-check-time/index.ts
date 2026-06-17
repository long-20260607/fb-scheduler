import { getSupabaseClient, corsHeaders, jsonResponse } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const supabase = getSupabaseClient()
    const { fingerId, code } = await req.json()

    if (!fingerId || !code) {
      await logAction(supabase, 'check', code, fingerId, req, 'failed', '参数不完整')
      return jsonResponse({ status: false, msg: '参数不完整' })
    }

    // 查询激活码
    const { data: codeData, error: codeError } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('code', code)
      .single()

    if (codeError || !codeData) {
      await logAction(supabase, 'check', code, fingerId, req, 'failed', '激活码不存在')
      return jsonResponse({ status: false, msg: '激活码不存在' })
    }

    // 检查激活码状态和过期（统一用码级 expire_at）
    const now = new Date()
    const isExpired = codeData.status !== 'active' || (codeData.expire_at && new Date(codeData.expire_at) < now)
    if (isExpired) {
      if (codeData.expire_at && new Date(codeData.expire_at) < now && codeData.status !== 'expired') {
        await supabase.from('activation_codes').update({ status: 'expired' }).eq('id', codeData.id)
      }
      await logAction(supabase, 'check', code, fingerId, req, 'failed', '激活码已失效')
      return jsonResponse({ status: false, msg: '激活码已失效' })
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
      return jsonResponse({ status: false, msg: '设备未激活' })
    }

    return jsonResponse({
      status: true,
      msg: '激活有效',
      data: codeData.expire_at || deviceData.expire_at
    })
  } catch (error) {
    console.error('检查激活状态失败:', error)
    return jsonResponse({ status: false, msg: '检查失败: ' + error.message }, 500)
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
