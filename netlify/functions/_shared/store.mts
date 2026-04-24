import { getStore } from '@netlify/blobs'

export interface Product {
  id: string
  name: string
  price: number
  description: string
  imageUrl: string
  category: string
  stock: number
}

export interface CartItem {
  cartItemId: string
  productId: string
  productName: string
  productCategory: string
  productImage: string
  quantity: number
  size?: string
  sleeveType?: string
  color?: string
  pdhName?: string
  basePrice: number
  surcharge: number
  itemTotalPrice: number
}

export interface Order {
  id: string
  name: string
  address: string
  phone: string
  deliveryMethod: string
  items: CartItem[]
  totalPrice: number
  surcharge: number
  uniqueCode: number
  finalTotal: number
  createdAt: string
}

export interface StoreSettings {
  storeName: string
  heroHeading1: string
  heroHeading2: string
  heroDescription: string
  heroBackgroundImage?: string
  themeAccentColor?: string
}

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'MPL Official Pro Jersey',
    price: 350000,
    description: 'Premium e-sports jersey with breathable material and official MPL patch.',
    imageUrl: 'https://images.unsplash.com/photo-1593030761757-71fae46af504?auto=format&fit=crop&q=80&w=800',
    category: 'KAOS',
    stock: 100,
  },
  {
    id: 'p2',
    name: 'MPL Core Black Hoodie',
    price: 450000,
    description: 'Comfortable heavyweight hoodie with minimalist MPL embroidery.',
    imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=800',
    category: 'KAOS',
    stock: 50,
  },
  {
    id: 'p3',
    name: 'MPL Snapback Cap',
    price: 200000,
    description: 'Adjustable snapback cap with 3D puff embroidery MPL logo.',
    imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&q=80&w=800',
    category: 'Lainnya',
    stock: 200,
  },
  {
    id: 'p4',
    name: 'MPL Gaming Mousepad',
    price: 250000,
    description: 'Extended size gaming mousepad with anti-slip rubber base.',
    imageUrl: 'https://images.unsplash.com/photo-1616423640778-28d1b53229bd?auto=format&fit=crop&q=80&w=800',
    category: 'Lainnya',
    stock: 75,
  },
]

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'MPL STORE',
  heroHeading1: 'ESPORTS WEAR',
  heroHeading2: 'Official Merchandise',
  heroDescription:
    'Support your favorite teams with premium quality apparel and gear. Exclusive collections available now.',
  heroBackgroundImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80',
  themeAccentColor: '#ff0033',
}

const DEFAULT_PASSWORD = 'admin123'
const ADMIN_TOKEN = 'admin-secret-token'

const storeName = () => getStore({ name: 'mpl-store', consistency: 'strong' })

export async function getProducts(): Promise<Product[]> {
  const store = storeName()
  const data = await store.get('products', { type: 'json' })
  if (!data) {
    await store.setJSON('products', DEFAULT_PRODUCTS)
    return DEFAULT_PRODUCTS
  }
  return data as Product[]
}

export async function saveProducts(products: Product[]): Promise<void> {
  await storeName().setJSON('products', products)
}

export async function getOrders(): Promise<Order[]> {
  const data = await storeName().get('orders', { type: 'json' })
  return (data as Order[] | null) ?? []
}

export async function saveOrders(orders: Order[]): Promise<void> {
  await storeName().setJSON('orders', orders)
}

export async function getSettings(): Promise<StoreSettings> {
  const data = await storeName().get('settings', { type: 'json' })
  if (!data) {
    await storeName().setJSON('settings', DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  }
  return { ...DEFAULT_SETTINGS, ...(data as StoreSettings) }
}

export async function saveSettings(settings: StoreSettings): Promise<void> {
  await storeName().setJSON('settings', settings)
}

export async function getAdminPassword(): Promise<string> {
  const pwd = await storeName().get('admin-password', { type: 'text' })
  return pwd || DEFAULT_PASSWORD
}

export async function saveAdminPassword(password: string): Promise<void> {
  await storeName().set('admin-password', password)
}

export function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${ADMIN_TOKEN}`
}

export function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

export { ADMIN_TOKEN }
