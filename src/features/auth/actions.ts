'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(input: {
  email: string
  password: string
}): Promise<{ error: string }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (error) return { error: error.message }

  redirect('/dashboard')
}
