import type { Config } from '@netlify/functions'
import { getAdminPassword, ADMIN_TOKEN } from './_shared/store.mts'

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { username, password } = (await req.json()) as {
    username?: string
    password?: string
  }
  const storedPassword = await getAdminPassword()

  if (username === 'admin' && password === storedPassword) {
    return Response.json({ token: ADMIN_TOKEN })
  }
  return Response.json({ error: 'Username atau Password salah.' }, { status: 401 })
}

export const config: Config = {
  path: '/api/auth/login',
}
