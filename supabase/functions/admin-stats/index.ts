import { getSupabaseClient, corsHeaders, jsonResponse, verifyToken } from '../_shared/supabase.ts'

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

    // 获取统计数据
    const [codesCount, activeCodesCount, activeDevicesCount, todayActivations] = await Promise.all([
      supabase.from('activation_codes').select('*', { count: 'exact', head: true }),
      supabase.from('activation_codes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('device_activations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('activation_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'activate')
        .eq('result', 'success')
        .gte('created_at', new Date().toISOString().split('T')[0])
    ])

    // 最近 7 天的激活趋势
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: trendData } = await supabase
      .from('activation_logs')
      .select('created_at')
      .eq('action', 'activate')
      .eq('result', 'success')
      .gte('created_at', sevenDaysAgo.toISOString())

    // 按日期分组统计
    const trendMap: Record<string, number> = {}
    ;(trendData || []).forEach(item => {
      const date = item.created_at.split('T')[0]
      trendMap[date] = (trendMap[date] || 0) + 1
    })

    const trend = Object.entries(trendMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return jsonResponse({
      status: true,
      data: {
        totalCodes: codesCount.count || 0,
        activeCodes: activeCodesCount.count || 0,
        activeDevices: activeDevicesCount.count || 0,
        todayActivations: todayActivations.count || 0,
        trend
      }
    })
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return jsonResponse({ status: false, msg: '获取失败: ' + error.message }, 500)
  }
})
