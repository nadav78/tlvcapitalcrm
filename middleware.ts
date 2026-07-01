import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Supabase may rotate the auth token during getUser(). When that happens, the
// new token is written onto supabaseResponse — not the redirect response. This
// helper copies those cookies so the rotated session survives the redirect.
function redirectWithSession(destination: URL, sessionResponse: NextResponse): NextResponse {
  const response = NextResponse.redirect(destination)
  sessionResponse.cookies.getAll().forEach(({ name, value, ...opts }) =>
    response.cookies.set(name, value, opts),
  )
  return response
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh the session so the token stays valid.
  // getUser() is preferred over getSession() — it validates with the Supabase server.
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Unauthenticated → login, preserving the originally requested path
  if (!user && !pathname.startsWith('/login')) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return redirectWithSession(loginUrl, supabaseResponse)
  }

  // Authenticated → away from login
  if (user && pathname.startsWith('/login')) {
    return redirectWithSession(new URL('/dashboard', request.url), supabaseResponse)
  }

  // /settings is Admin-only
  if (user && pathname.startsWith('/settings')) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return redirectWithSession(new URL('/dashboard', request.url), supabaseResponse)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
