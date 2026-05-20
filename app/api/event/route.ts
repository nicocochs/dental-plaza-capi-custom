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

    const email           = body.email           || body.customData?.email
    const phone           = body.phone           || body.customData?.phone
    const firstName       = body.firstName       || body.customData?.firstName
    const lastName        = body.lastName        || body.customData?.lastName
    const city            = body.city            || body.customData?.city
    const state           = body.state           || body.customData?.state
    const fbc             = body.fbc             || body.customData?.fbc
    const fbp             = body.fbp             || body.customData?.fbp
    const clientIp        = body.clientIp        || body.customData?.clientIp        || body.ip        || body.customData?.ip
    const clientUserAgent = body.clientUserAgent || body.customData?.clientUserAgent || body.userAgent || body.customData?.userAgent
    const eventName       = body.eventName       || body.customData?.eventName       || 'consulta_solicitada'
    const eventId         = body.eventId         || body.customData?.eventId
    const pageUrl         = body.pageUrl         || body.customData?.pageUrl         || 'https://carillascopiapo.cl'
    const value           = body.value           || body.customData?.value
    const currency        = body.currency        || body.customData?.currency        || 'CLP'
    const testCode        = body.testCode        || body.customData?.testCode

    const userData: Record<string, unknown> = {
      em: email     ? [sha256(email)]                         : [],
      ph: phone     ? [sha256(normalizePhone(phone))]         : [],
      fn: firstName ? [sha256(firstName)]                     : [],
      ln: lastName  ? [sha256(lastName)]                      : [],
      ct: city      ? [sha256(city)]                          : [],
      st: state     ? [sha256(state)]                         : [],
      country: [sha256('cl')],
    }
    if (clientIp)        userData.client_ip_address = clientIp
    if (clientUserAgent) userData.client_user_agent = clientUserAgent
    if (fbc)             userData.fbc = fbc
    if (fbp)             userData.fbp = fbp

    const eventTime = Math.floor(Date.now() / 1000)
    const customEvent: Record<string, unknown> = {
      event_name: eventName,
      event_time: eventTime,
      action_source: 'website',
      event_source_url: pageUrl,
      user_data: userData,
    }
    if (eventId) customEvent.event_id = `${eventId}_cs`
    if (value && currency) {
      customEvent.value = parseFloat(value)
      customEvent.currency = currency
    }

    const data: Record<string, unknown>[] = []
    if (eventName === 'consulta_solicitada') {
      const leadEvent: Record<string, unknown> = {
        event_name: 'Lead',
        event_time: eventTime,
        action_source: 'website',
        event_source_url: pageUrl,
        user_data: userData,
      }
      if (eventId) leadEvent.event_id = eventId
      data.push(leadEvent)
    }
    data.push(customEvent)

    const payload: Record<string, unknown> = {
      data,
      access_token: CAPI_TOKEN,
    }
    if (testCode) payload.test_event_code = testCode

    console.log('[capi-request]', {
      eventName,
      email:   email   ? 'present' : 'missing',
      fbc:     fbc     ? 'present' : 'missing',
      fbp:     fbp     ? 'present' : 'missing',
      eventId: eventId ? 'present' : 'missing',
      source: body.eventName ? 'root' : 'customData',
    })

    const res = await fetch(CAPI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const resData = await res.json()
    console.log('[capi]', JSON.stringify(resData))
    return Response.json(resData, {
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
