'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

  // Guards against protocol-relative (`//evil.com`) and backslash-based
  // (`/\evil.com`) bypasses — browsers normalize a leading backslash to a
  // second forward slash when resolving a relative reference, turning it
  // into a network-path (protocol-relative) reference.
  const isSafeRedirect =
    typeof input.next === 'string' &&
    /^\/(?!\/|\\)/.test(input.next)
  redirect(isSafeRedirect ? input.next! : '/dashboard')
}
