import { Suspense } from 'react'
import ShipMap from '@/components/ShipMap'
import TopNav from '@/components/TopNav'

export default function Home() {
  return (
    <main className="flex h-screen flex-col bg-slate-950">
      <TopNav />

      <section className="min-h-0 flex-1">
        <Suspense fallback={<div className="h-full w-full bg-slate-950" />}>
          <ShipMap />
        </Suspense>
      </section>
    </main>
  )
}
