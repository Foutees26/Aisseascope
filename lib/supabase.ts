import { createClient } from '@supabase/supabase-js'

let supabaseClient: any = null

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  return supabaseClient
}

export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseClient()
      if (!client) {
        throw new Error('Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      }

      const value = client[prop]
      return typeof value === 'function' ? value.bind(client) : value
    },
  }
) as any
