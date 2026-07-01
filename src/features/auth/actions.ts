'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectPath } from '@/lib/redirect'

export async function signIn(input: {
  email: string
  password: string
  next?: string
}): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (error) return { error: error.message }

  redirect(safeRedirectPath(input.next) ?? '/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  // scope:'local' clears the session cookie without a server-side token revocation
  // round-trip — avoids a 10-15s delay when the Supabase auth API is slow.
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login')
}
