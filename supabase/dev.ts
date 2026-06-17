// supabase/dev.ts — 本地开发服务器，无需 Docker
// 用法: deno run --allow-net --allow-env --allow-read supabase/dev.ts

import { load } from 'https://deno.land/std@0.224.0/dotenv/mod.ts'

const env = await load({ envPath: './supabase/.env' })
for (const [k, v] of Object.entries(env)) {
  if (!Deno.env.get(k)) Deno.env.set(k, v)
}

// 拦截 Deno.serve()，收集函数处理器
const handlers = new Map<string, (req: Request) => Response | Promise<Response>>()

const origServe = Deno.serve.bind(Deno)
Deno.serve = (optsOrHandler: any, maybeHandler?: any) => {
  const handler = typeof optsOrHandler === 'function' ? optsOrHandler : maybeHandler
  // 通过 Error 堆栈找调用者目录名
  const stack = new Error().stack ?? ''
  const match = stack.match(/functions[/\\]([^/\\]+)[/\\]index\.ts/)
  const fnName = match?.[1] ?? 'unknown'
  handlers.set(fnName, handler)
  return { finished: Promise.resolve(), ref() {}, unref() {}, shutdown() {} } as any
}

// 动态导入所有函数
const functionDirs = [
  'plugin-check-time', 'plugin-active', 'plugin-unactive',
  'admin-codes', 'admin-login', 'admin-logs', 'admin-stats',
]

for (const dir of functionDirs) {
  try {
    await import(`./functions/${dir}/index.ts`)
    console.log(`  ✓ ${dir}`)
  } catch (e) {
    console.log(`  ✗ ${dir}: ${e.message}`)
  }
}

Deno.serve = origServe

// 启动路由器
const PORT = 54321
console.log(`\n🚀 http://localhost:${PORT}/functions/v1/<function-name>`)

origServe({ port: PORT }, async (req) => {
  const url = new URL(req.url)
  const match = url.pathname.match(/^\/functions\/v1\/(.+?)(?:\/|$)/)
  if (!match) {
    return new Response(JSON.stringify({ error: 'Not found. Use /functions/v1/<name>' }), {
      status: 404, headers: { 'content-type': 'application/json' },
    })
  }
  const handler = handlers.get(match[1])
  if (!handler) {
    return new Response(JSON.stringify({ error: `Function "${match[1]}" not found` }), {
      status: 404, headers: { 'content-type': 'application/json' },
    })
  }
  return handler(req)
})
