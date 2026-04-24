import type { Config, Context } from '@netlify/functions'
import {
  getOrders,
  saveOrders,
  getProducts,
  saveProducts,
  isAuthorized,
  unauthorized,
  type Order,
} from './_shared/store.mts'

export default async (req: Request, context: Context) => {
  const id = context.params.id

  if (req.method === 'POST' && !id) {
    try {
      const body = (await req.json()) as Partial<Order>
      const items = body.items

      if (!items || !Array.isArray(items) || items.length === 0) {
        return Response.json({ error: 'Keranjang kosong' }, { status: 400 })
      }

      const products = await getProducts()

      for (const item of items) {
        const product = products.find((p) => p.id === item.productId)
        if (!product) {
          return Response.json(
            { error: `Produk ${item.productName} tidak ditemukan` },
            { status: 404 },
          )
        }
        if (product.stock < item.quantity) {
          return Response.json(
            { error: `Stok ${item.productName} tidak mencukupi (Sisa: ${product.stock})` },
            { status: 400 },
          )
        }
      }

      for (const item of items) {
        const index = products.findIndex((p) => p.id === item.productId)
        if (index !== -1) {
          products[index].stock -= item.quantity
        }
      }
      await saveProducts(products)

      const newOrder: Order = {
        id: Math.random().toString(36).substring(2, 9),
        name: body.name ?? '',
        address: body.address ?? '',
        phone: body.phone ?? '',
        deliveryMethod: body.deliveryMethod ?? 'Kirim',
        items,
        totalPrice: body.totalPrice ?? 0,
        surcharge: body.surcharge ?? 0,
        uniqueCode: body.uniqueCode ?? 0,
        finalTotal: body.finalTotal ?? 0,
        createdAt: new Date().toISOString(),
      }

      const orders = await getOrders()
      orders.push(newOrder)
      const trimmed = orders.length > 500 ? orders.slice(orders.length - 500) : orders
      await saveOrders(trimmed)

      return Response.json({ success: true, order: newOrder }, { status: 201 })
    } catch {
      return Response.json({ error: 'Failed to create order' }, { status: 500 })
    }
  }

  if (!isAuthorized(req)) return unauthorized()

  if (req.method === 'GET' && !id) {
    const orders = await getOrders()
    return Response.json(orders.slice().reverse())
  }

  if (req.method === 'DELETE' && id) {
    const orders = await getOrders()
    await saveOrders(orders.filter((o) => o.id !== id))
    return Response.json({ success: true })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}

export const config: Config = {
  path: ['/api/orders', '/api/orders/:id'],
}
