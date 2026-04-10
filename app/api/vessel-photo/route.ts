import { NextRequest, NextResponse } from 'next/server'

type WikiSearchResponse = {
  query?: {
    search?: Array<{
      title: string
      pageid: number
    }>
  }
}

type WikiImageResponse = {
  query?: {
    pages?: Record<
      string,
      {
        thumbnail?: {
          source?: string
        }
        fullurl?: string
      }
    >
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const name = (searchParams.get('name') ?? '').trim()

  if (!name) {
    return NextResponse.json({ imageUrl: null, pageUrl: null, source: null })
  }

  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srsearch=${encodeURIComponent(name + ' vessel')}`
  const searchRes = await fetch(searchUrl, { cache: 'no-store' })

  if (!searchRes.ok) {
    return NextResponse.json({ imageUrl: null, pageUrl: null, source: null })
  }

  const searchData = (await searchRes.json()) as WikiSearchResponse
  const first = searchData.query?.search?.[0]

  if (!first) {
    return NextResponse.json({ imageUrl: null, pageUrl: null, source: null })
  }

  const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages|info&inprop=url&pithumbsize=800&format=json&origin=*&pageids=${first.pageid}`
  const imageRes = await fetch(imageUrl, { cache: 'no-store' })

  if (!imageRes.ok) {
    return NextResponse.json({ imageUrl: null, pageUrl: null, source: null })
  }

  const imageData = (await imageRes.json()) as WikiImageResponse
  const page = imageData.query?.pages?.[String(first.pageid)]

  return NextResponse.json({
    imageUrl: page?.thumbnail?.source ?? null,
    pageUrl: page?.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(first.title.replace(/\s+/g, '_'))}`,
    source: 'Wikipedia',
  })
}
