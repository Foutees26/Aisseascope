'use client'

import Link from 'next/link'
import { FormEvent, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

function menuClass(isActive: boolean) {
  return isActive
    ? 'rounded-md bg-cyan-600 px-3 py-1.5 font-medium text-white'
    : 'rounded-md bg-slate-700 px-3 py-1.5 text-slate-100 hover:bg-slate-600'
}

export default function TopNav() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentQuery = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(currentQuery)
  const [suggestions, setSuggestions] = useState<Array<{ mmsi: string; vessel_name: string | null }>>([])
  const [isFocused, setIsFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const navigateToSearch = (value: string) => {
    const trimmed = value.trim()
    const params = new URLSearchParams()

    if (trimmed) {
      params.set('q', trimmed)
    }

    const suffix = params.toString() ? `?${params.toString()}` : ''
    router.push(`/${suffix}`)
  }

  const fetchSuggestions = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setSuggestions([])
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vessels/search?q=${encodeURIComponent(trimmed)}`)
        if (!res.ok) return
        const data = (await res.json()) as {
          suggestions?: Array<{ mmsi: string; vessel_name: string | null }>
        }
        setSuggestions(data.suggestions ?? [])
      } catch {
        // Ignore transient suggestion fetch failures.
      }
    }, 180)
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    navigateToSearch(query)
    setIsFocused(false)
  }

  const clearSearch = () => {
    setQuery('')
    setSuggestions([])
    setIsFocused(false)
    router.push('/')
  }

  return (
    <>
      <header className="border-b border-slate-700 bg-slate-900 px-6 py-4 text-white">
        <h1 className="text-2xl font-bold tracking-wide">Seascope Ship Tracker</h1>
      </header>

      <nav className="border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ul className="flex flex-wrap items-center gap-2 text-sm">
          <li>
            <Link href="/" className={menuClass(pathname === '/')}>
              Live Map
            </Link>
          </li>
          <li>
            <Link href="/dashboard" className={menuClass(pathname === '/dashboard')}>
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/arrivals" className={menuClass(pathname === '/arrivals')}>
              Arrivals
            </Link>
          </li>
          <li>
            <Link href="/vessels" className={menuClass(pathname === '/vessels')}>
              Vessels
            </Link>
          </li>
          <li>
            <Link href="/calculator" className={menuClass(pathname === '/calculator')}>
              Calculator
            </Link>
          </li>
          </ul>

          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <div className="relative">
              <input
                name="vesselQuery"
                type="text"
                value={query}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 100)}
                onChange={(e) => {
                  const value = e.target.value
                  setQuery(value)
                  fetchSuggestions(value)
                }}
                placeholder="Search vessel name or MMSI"
                className="w-64 rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
              />

              {isFocused && suggestions.length > 0 && (
                <div className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-600 bg-slate-900 shadow-lg">
                  {suggestions.map((item) => {
                    const label = item.vessel_name?.trim() || 'Unknown Vessel'
                    return (
                      <button
                        key={item.mmsi}
                        type="button"
                        onMouseDown={() => {
                          setQuery(item.mmsi)
                          setSuggestions([])
                          navigateToSearch(item.mmsi)
                          setIsFocused(false)
                        }}
                        className="block w-full border-b border-slate-700 px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800 last:border-b-0"
                      >
                        <span className="block truncate font-medium">{label}</span>
                        <span className="block text-xs text-slate-400">MMSI: {item.mmsi}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="rounded-md bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500"
            >
              Search
            </button>
            {(currentQuery || query) && (
              <button
                type="button"
                onClick={clearSearch}
                className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
              >
                Clear
              </button>
            )}
          </form>
        </div>
      </nav>
    </>
  )
}
