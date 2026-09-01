import { NextResponse } from 'next/server'
import { verifySeat } from '@/lib/ably/seat'
import { mintTokenRequest } from '@/lib/ably/token'
import { normalizeCode } from '@/lib/game/codes'

/**
 * An Ably token, so the key stays on the server.
 *
 * This is the `authUrl` the browser SDK fetches, which constrains the response
 * exactly: **the bare `TokenRequest`, with nothing around it.** Ably rejects an
 * envelope outright, so the seat that comes with it lives at
 * `/api/ably/seat` instead.
 *
 * The seat arrives signed or it does not arrive: `clientId` is never taken on
 * trust, because Ably stamps it onto every message this client publishes and
 * refuses any other. That check is the whole security boundary — see
 * `lib/ably/seat.ts`.
 *
 * And it never caches. The deleted GIF route once set `s-maxage`; a minted token is the
 * one response in the app that must not be shared or replayed.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const params = new URL(request.url).searchParams
  const roomCode = normalizeCode(params.get('room') ?? '')
  const apiKey = process.env.ABLY_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Realtime isn’t configured. Set ABLY_API_KEY and restart the server.' },
      { status: 500 },
    )
  }

  if (!roomCode) {
    return NextResponse.json(
      { error: 'That isn’t a room code, so there is nothing to join.' },
      { status: 400 },
    )
  }

  const seat = params.get('seat')
  const signature = params.get('sig')
  if (!seat || !signature || !verifySeat(seat, signature, apiKey)) {
    return NextResponse.json(
      { error: 'That seat isn’t yours. Reload to be given one.' },
      { status: 403 },
    )
  }

  try {
    const tokenRequest = await mintTokenRequest(seat, roomCode, apiKey)
    // Bare, deliberately: the SDK parses this object directly and rejects
    // anything wrapped around it.
    return NextResponse.json(tokenRequest, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[api/ably/token] mint failed', error)
    return NextResponse.json(
      { error: 'Realtime isn’t answering. Try again in a moment.' },
      { status: 502 },
    )
  }
}
