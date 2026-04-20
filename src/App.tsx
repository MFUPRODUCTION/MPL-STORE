import React from "react";
import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { ThemeConfig } from "./components/ThemeConfig";
import { Home } from "./pages/Home";
import { Products } from "./pages/Products";
import { Cart } from "./pages/Cart";
import { ProductDetail } from "./pages/ProductDetail";
import { AdminLogin } from "./pages/admin/Login";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { CartProvider } from "./context/CartContext";

function PublicLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <CartProvider>
      <Router>
        <ThemeConfig />
        <Routes>
          {/* Public Routes with Navbar */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/product" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
          </Route>

          {/* Admin Routes without Navbar */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
      </Router>
    </CartProvider>
  );
}
