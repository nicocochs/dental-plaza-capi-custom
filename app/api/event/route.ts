import { createHash } from 'crypto'

const PIXEL_ID = process.env.PIXEL_ID!
const CAPI_TOKEN = process.env.CAPI_TOKEN!
const CAPI_URL = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events`

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const email     = body.email     || body.customData?.email
    const phone     = body.phone     || body.customData?.phone
    const firstName = body.firstName || body.customData?.firstName
    const lastName  = body.lastName  || body.customData?.lastName
    const eventName = body.eventName || body.customData?.eventName || 'Consulta_solicitada'
    const value     = body.value     || body.customData?.value
    const currency  = body.currency  || body.customData?.currency
    const testCode  = body.testCode  || body.customData?.testCode

    console.log('[capi-request]', { eventName, email: email ? 'present' : 'missing' })

    const userData: Record<string, string> = {}
    if (email)     userData.em = sha256(email)
    if (phone)     userData.ph = sha256(normalizePhone(phone))
    if (firstName) userData.fn = sha256(firstName)
    if (lastName)  userData.ln = sha256(lastName)

    const fbp = body.fbp || body.customData?.fbp
    const fbc = body.fbc || body.customData?.fbc
    const clientIp        = body.clientIp        || body.customData?.clientIp
    const clientUserAgent = body.clientUserAgent || body.customData?.clientUserAgent

    if (fbp)             userData.fbp = fbp
    if (fbc)             userData.fbc = fbc
    if (clientIp)        userData.client_ip_address = clientIp
    if (clientUserAgent) userData.client_user_agent = clientUserAgent

    const payload: Record<string, unknown> = {
      access_token: CAPI_TOKEN,
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          event_source_url: 'https://carillascopiapo.cl',
          user_data: userData,
          ...(value && currency ? { value: parseFloat(value), currency } : {}),
        },
      ],
    }

    if (testCode) payload.test_event_code = testCode

    const res = await fetch(CAPI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    console.log('[capi]', JSON.stringify(data))
    return Response.json(data, {
      status: res.ok ? 200 : 502,
      headers: CORS_HEADERS,
    })
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
