import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Standard server client — uses the logged-in user's session from cookies.
// In test environments, set SUPABASE_TEST_TOKEN to an access_token so tests can
// call Server Actions without a Next.js request context.
export async function createClient() {
  if (process.env.SUPABASE_TEST_TOKEN) {
    return createServerClient<Database>(URL, ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${process.env.SUPABASE_TEST_TOKEN}` },
      },
      cookies: { getAll: () => [], setAll: () => {} },
    })
  }

  const cookieStore = await cookies()
  return createServerClient<Database>(URL, ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // setAll throws in read-only Server Component contexts — safe to ignore
        }
      },
    },
  })
}

// Service role client — bypasses RLS entirely. Only for Server Actions that need
// to write records the calling user's RLS policy blocks (e.g. closeOpportunity).
// The Server Action is responsible for all authorization checks before using this.
export function createServiceClient() {
  return createSupabaseClient<Database>(URL, SERVICE_KEY)
}
