// Cloudflare Pages Advanced Mode worker.
// 把 /api/* 反向代理到 Supabase Edge Functions，浏览器侧只连接 pages.dev。
// 原因：*.supabase.co 在部分网络会在 TLS 握手阶段被重置（SNI 命中规则），
// 请求根本到不了服务端。由 Cloudflare 边缘转发可绕开这段链路。
// 本文件放在 public/ 下，vite build 会原样复制到 dist/_worker.js，
// Git 集成部署上传 dist 后自动生效，无需额外配置。

const UPSTREAM_BASE = 'https://hizynzkovnnugjedqpuw.supabase.co/functions/v1'
const TIMEOUT_MS = 15000

// 路径安全校验：只允许「函数名[/子路径]」形式，挡住 ../、%编码等逃逸写法，
// 避免这个 Worker 被当成访问其他 Supabase 端点的开放代理。
// 这里刻意不枚举函数名 —— 线上若新增 Edge Function，不会因漏配而被 404。
const SAFE_SUBPATH = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?$/i

const FORWARD_REQUEST_HEADERS = [
  'authorization', 'apikey', 'content-type', 'accept',
  'x-client-info', 'x-requested-with'
]

function corsHeaders(request) {
  const origin = request.headers.get('Origin')
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin'
  }
}

function jsonResponse(body, status, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) }
  })
}

async function proxyApi(request) {
  const url = new URL(request.url)
  const subPath = url.pathname.slice('/api/'.length)

  if (!SAFE_SUBPATH.test(subPath)) {
    return jsonResponse({ status: false, msg: '非法接口路径' }, 400, request)
  }

  const headers = new Headers()
  for (const key of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(key)
    if (value) headers.set(key, value)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let upstream
  try {
    upstream = await fetch(`${UPSTREAM_BASE}/${subPath}${url.search}`, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      signal: controller.signal
    })
  } catch (err) {
    // 上游不可达时返回结构化 JSON，避免前端只拿到笼统的 Network Error
    return jsonResponse(
      { status: false, msg: '授权服务暂时不可达，请稍后重试' },
      502,
      request
    )
  } finally {
    clearTimeout(timer)
  }

  const outHeaders = new Headers(upstream.headers)
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    outHeaders.set(key, value)
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (!url.pathname.startsWith('/api/')) {
      const asset = await env.ASSETS.fetch(request)
      // Advanced Mode 下 Pages 不再自动做 SPA fallback，需手动回落
      if (asset.status !== 404 || /\.[a-z0-9]+$/i.test(url.pathname)) {
        return asset
      }
      const indexUrl = new URL('/index.html', url.origin).toString()
      const index = await env.ASSETS.fetch(new Request(indexUrl))
      return new Response(index.body, {
        status: 200,
        headers: index.headers
      })
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    return proxyApi(request)
  }
}
