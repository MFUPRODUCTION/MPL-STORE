export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  category: string;
  stock: number;
}

export interface CartItem {
  cartItemId: string; // unique
  productId: string;
  productName: string;
  productCategory: string;
  productImage: string;
  quantity: number;
  size?: string;
  sleeveType?: string;
  color?: string;
  pdhName?: string;
  basePrice: number;
  surcharge: number;
  itemTotalPrice: number;
}

export interface Order {
  id: string;
  name: string;
  address: string;
  phone: string;
  deliveryMethod: string;
  items: CartItem[];
  totalPrice: number;
  surcharge: number;
  uniqueCode: number;
  finalTotal: number;
  createdAt: string;
}

export interface StoreSettings {
  storeName: string;
  heroHeading1: string;
  heroHeading2: string;
  heroDescription: string;
  heroBackgroundImage?: string;
  themeAccentColor?: string;
}
