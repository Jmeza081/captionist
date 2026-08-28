import { NextResponse } from 'next/server'
import { mintSeat, verifySeat } from '@/lib/ably/seat'

/**
 * Which seat this tab is allowed to be, and whether realtime is configured.
 *
 * `GET /api/ably/seat` mints a seat and returns it signed.
 * `GET /api/ably/seat?seat=…&sig=…` returns the same seat back, if the
 * signature proves we issued it — which is how a reload keeps its chair.
 *
 * **Separate from `/api/ably/token` because Ably's `authUrl` will not accept an
 * envelope.** The SDK expects the bare token payload and rejects anything with
 * extra fields around it ("The returned object has neither a keyName nor an
 * issued field"). The seat and the token are two answers with two consumers, so
 * they are two routes rather than one response the SDK cannot parse.
 *
 * It never takes a seat on trust: an unsigned one is refused and a fresh one
 * issued. Ably binds `clientId` into the token and rejects a publish claiming
 * another, so this is the only place the identity could be forged.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const params = new URL(request.url).searchParams

  const apiKey = process.env.ABLY_API_KEY
  const production = process.env.NODE_ENV === 'production'
  const stubbed =
    process.env.ABLY_STUB === '1' || (!production && params.get('stub') === '1')

  // A server with no key cannot sign a seat any more than it can mint a token.
  // Stubbed, the seat is still real — the room uses it as a player id whichever
  // transport it ends up on.
  const secret = apiKey ?? 'captionist-stub-secret'

  const given = params.get('seat')
  const signature = params.get('sig')
  const held = given && signature && verifySeat(given, signature, secret)
  const identity = held ? { seat: given, signature } : mintSeat(secret)

  return NextResponse.json(
    { ...identity, stub: stubbed || (!apiKey && !production) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
