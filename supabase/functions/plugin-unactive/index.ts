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
      await logAction(supabase, 'deactivate', code, fingerId, req, 'failed', '参数不完整')
      return jsonResponse({ status: false, msg: '参数不完整' }, 200, origin)
    }

    // 查询激活码
    const { data: codeData, error: codeError } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('code', code)
      .single()

    if (codeError || !codeData) {
      await logAction(supabase, 'deactivate', code, fingerId, req, 'failed', '激活码不存在')
      return jsonResponse({ status: false, msg: '激活码不存在' }, 200, origin)
    }

    // 查找并删除激活记录
    const { data: activationData } = await supabase
      .from('device_activations')
      .select('*')
      .eq('code_id', codeData.id)
      .eq('finger_id', fingerId)
      .single()

    if (!activationData) {
      await logAction(supabase, 'deactivate', code, fingerId, req, 'failed', '未找到激活记录')
      return jsonResponse({ status: false, msg: '未找到激活记录' }, 200, origin)
    }

    await supabase
      .from('device_activations')
      .delete()
      .eq('id', activationData.id)

    await logAction(supabase, 'deactivate', code, fingerId, req, 'success', '取消激活成功')

    return jsonResponse({ status: true, msg: '取消激活成功' }, 200, origin)
  } catch (error) {
    console.error('取消激活失败:', error)
    return jsonResponse({ status: false, msg: '取消激活失败' }, 500, origin)
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
