import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
}

export function corsHeaders(origin: string = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
  }
}

// base64url 解码（JWT 标准编码）
function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

export async function verifyToken(token: string): Promise<any> {
  const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'fb-scheduler-secret-2024-xK9mP2vL'
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  try {
    const [header, payload, signature] = token.split('.')
    const signatureBytes = base64UrlDecode(signature)
    const data = encoder.encode(`${header}.${payload}`)

    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, data)
    if (!valid) return null

    const payloadBytes = base64UrlDecode(payload)
    const decoder = new TextDecoder()
    return JSON.parse(decoder.decode(payloadBytes))
  } catch {
    return null
  }
}

export function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
