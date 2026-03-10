import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * 現状: 認証・許可メール制限は行わず、URL を知っていれば誰でも閲覧可能。
 * 制限を再度有効にする場合は、下記のコメントアウトを外して return response の前に配置する。
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  try {
    // セッションの更新（接続できない場合は短時間で諦めて通過させる）
    const timeoutMs = 3000
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ])
  } catch {
    // Supabase に接続できない／タイムアウトの場合はそのまま通過させる
  }

  // --- 認証・許可メール制限（必要になったらコメントを外す）---
  // const { data: { user } } = await supabase.auth.getUser()
  // const pathname = request.nextUrl.pathname
  // const isPublicPath = pathname === '/login' || pathname.startsWith('/auth/') || pathname === '/access-denied'
  // if (!user && !isPublicPath) {
  //   const loginUrl = new URL('/login', request.url)
  //   loginUrl.searchParams.set('next', pathname)
  //   return NextResponse.redirect(loginUrl)
  // }
  // if (user && !isPublicPath && pathname !== '/access-denied') {
  //   const { data: allowed } = await supabase.from('allowed_emails').select('email').eq('email', user.email ?? '').maybeSingle()
  //   if (!allowed) return NextResponse.redirect(new URL('/access-denied', request.url))
  // }

  return response
}
