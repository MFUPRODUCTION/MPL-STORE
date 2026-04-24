import type { Config } from '@netlify/functions'
import {
  getSettings,
  saveSettings,
  isAuthorized,
  unauthorized,
  type StoreSettings,
} from './_shared/store.mts'

export default async (req: Request) => {
  if (req.method === 'GET') {
    const settings = await getSettings()
    return Response.json(settings)
  }

  if (!isAuthorized(req)) return unauthorized()

  if (req.method === 'PUT') {
    const current = await getSettings()
    const body = (await req.json()) as Partial<StoreSettings>
    const merged: StoreSettings = { ...current, ...body }
    await saveSettings(merged)
    return Response.json({ success: true, settings: merged })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}

export const config: Config = {
  path: '/api/settings',
}
