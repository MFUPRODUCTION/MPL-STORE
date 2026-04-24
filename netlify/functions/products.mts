import type { Config, Context } from '@netlify/functions'
import {
  getProducts,
  saveProducts,
  isAuthorized,
  unauthorized,
  type Product,
} from './_shared/store.mts'

export default async (req: Request, context: Context) => {
  const id = context.params.id

  if (req.method === 'GET' && !id) {
    const products = await getProducts()
    return Response.json(products)
  }

  if (!isAuthorized(req)) return unauthorized()

  if (req.method === 'POST' && !id) {
    const body = (await req.json()) as Partial<Product>
    const newProduct: Product = {
      id: 'p' + Date.now().toString(),
      name: body.name ?? '',
      price: body.price ?? 0,
      description: body.description ?? '',
      imageUrl: body.imageUrl ?? '',
      category: body.category ?? 'Lainnya',
      stock: body.stock ?? 0,
    }
    const products = await getProducts()
    products.push(newProduct)
    await saveProducts(products)
    return Response.json({ success: true, product: newProduct }, { status: 201 })
  }

  if (req.method === 'PUT' && id) {
    const body = (await req.json()) as Partial<Product>
    const products = await getProducts()
    const index = products.findIndex((p) => p.id === id)
    if (index === -1) {
      return Response.json({ error: 'Product not found' }, { status: 404 })
    }
    products[index] = { ...products[index], ...body, id: products[index].id }
    await saveProducts(products)
    return Response.json({ success: true, product: products[index] })
  }

  if (req.method === 'DELETE' && id) {
    const products = await getProducts()
    const filtered = products.filter((p) => p.id !== id)
    await saveProducts(filtered)
    return Response.json({ success: true })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}

export const config: Config = {
  path: ['/api/products', '/api/products/:id'],
}
