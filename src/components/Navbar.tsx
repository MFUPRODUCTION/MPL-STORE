import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, LayoutDashboard, Menu, X, ShoppingCart } from "lucide-react";
import React, { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { StoreSettings } from "../types";
import { useCart } from "../context/CartContext";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { cartCount } = useCart();
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: "MPL STORE",
    heroHeading1: "",
    heroHeading2: "",
    heroDescription: ""
  });

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(console.error);
  }, []);

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Merchandise", path: "/products" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-mpl-bg border-b border-mpl-border text-mpl-text h-[60px] flex items-center">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-full">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1 font-extrabold text-[1.2rem] tracking-[-0.05em] text-mpl-text uppercase">
            {settings.storeName}
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex gap-6 items-center">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "text-[0.85rem] font-medium transition-colors uppercase tracking-[0.05em]",
                    location.pathname === link.path ? "text-mpl-text" : "text-mpl-text-dim hover:text-mpl-text"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </div>
            
            <div className="h-4 w-px bg-mpl-border"></div>
            
            <Link 
              to="/admin/dashboard" 
              className={cn(
                "text-[0.85rem] font-medium transition-colors uppercase tracking-[0.05em]",
                location.pathname.includes('/admin') ? "text-mpl-text" : "text-mpl-text-dim hover:text-mpl-text"
              )}
            >
              Admin
            </Link>
            
            <Link to="/cart" className="relative text-mpl-text hover:text-mpl-accent transition-colors ml-4">
               <ShoppingCart className="w-5 h-5" />
               {cartCount > 0 && (
                 <span className="absolute -top-1.5 -right-1.5 bg-mpl-accent text-white text-[0.6rem] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                   {cartCount}
                 </span>
               )}
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-4">
            <Link to="/cart" className="relative text-mpl-text hover:text-mpl-accent transition-colors">
               <ShoppingCart className="w-5 h-5" />
               {cartCount > 0 && (
                 <span className="absolute -top-1.5 -right-1.5 bg-mpl-accent text-white text-[0.6rem] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                   {cartCount}
                 </span>
               )}
            </Link>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-mpl-text-dim hover:text-mpl-text focus:outline-none"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden bg-mpl-surface border-b border-mpl-border absolute top-[60px] left-0 right-0">
          <div className="px-4 pt-2 pb-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm font-medium uppercase tracking-[0.05em]",
                  location.pathname === link.path
                    ? "bg-[#222] text-mpl-text"
                    : "text-mpl-text-dim hover:bg-[#222] hover:text-mpl-text"
                )}
              >
                {link.name}
              </Link>
            ))}
            <Link
              to="/admin/dashboard"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-mpl-text-dim hover:bg-[#222] hover:text-mpl-text uppercase tracking-[0.05em]"
            >
              Admin Dashboard
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
