import { createFlagsDiscoveryEndpoint } from 'flags/next'
import { getProviderData } from '@flags-sdk/vercel'
import * as flags from '@/flags'

/**
 * What the Vercel Toolbar's Flags Explorer reads to list the flags and let
 * someone on the team override one for their own session. Guarded by
 * `FLAGS_SECRET`; without it the endpoint answers 401 and nothing else changes.
 */
export const GET = createFlagsDiscoveryEndpoint(() => getProviderData(flags))
