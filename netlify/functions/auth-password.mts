import type { Config } from '@netlify/functions'
import {
  getAdminPassword,
  saveAdminPassword,
  isAuthorized,
  unauthorized,
} from './_shared/store.mts'

export default async (req: Request) => {
  if (req.method !== 'PUT') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  if (!isAuthorized(req)) return unauthorized()

  const { oldPassword, newPassword } = (await req.json()) as {
    oldPassword?: string
    newPassword?: string
  }

  if (!newPassword || newPassword.length < 6) {
    return Response.json({ error: 'Password baru minimal 6 karakter.' }, { status: 400 })
  }

  const storedPassword = await getAdminPassword()
  if (oldPassword !== storedPassword) {
    return Response.json({ error: 'Password lama salah.' }, { status: 400 })
  }

  await saveAdminPassword(newPassword)
  return Response.json({ success: true })
}

export const config: Config = {
  path: '/api/auth/password',
}
