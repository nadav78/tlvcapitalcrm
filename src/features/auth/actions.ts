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
