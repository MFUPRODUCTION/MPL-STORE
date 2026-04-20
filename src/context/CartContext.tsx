import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { CartItem } from "../types";

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("mpl_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("mpl_cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      // Find if same product with same options exists
      const existingItemIndex = prev.findIndex(
        i => i.productId === item.productId && 
             i.size === item.size && 
             i.sleeveType === item.sleeveType && 
             i.color === item.color && 
             i.pdhName === item.pdhName
      );

      if (existingItemIndex !== -1) {
        const newCart = [...prev];
        const updatedQty = newCart[existingItemIndex].quantity + item.quantity;
        const total = (newCart[existingItemIndex].basePrice + newCart[existingItemIndex].surcharge) * updatedQty;

        newCart[existingItemIndex] = {
          ...newCart[existingItemIndex],
          quantity: updatedQty,
          itemTotalPrice: total
        };
        return newCart;
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter(i => i.cartItemId !== id));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => sum + item.itemTotalPrice, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
