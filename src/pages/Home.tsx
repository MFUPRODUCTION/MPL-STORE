import { Link } from "react-router-dom";
import { ArrowRight, Star, Truck, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Product, StoreSettings } from "../types";

export function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: "MPL STORE",
    heroHeading1: "ESPORTS WEAR",
    heroHeading2: "Official Merchandise",
    heroDescription: "Support your favorite teams with premium quality apparel and gear. Exclusive collections available now."
  });

  useEffect(() => {
    fetch("/api/products")
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(console.error);

    fetch("/api/settings")
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(console.error);
  }, []);

  const featuredProducts = products.slice(0, 3);

  return (
    <div className="min-h-screen bg-mpl-bg flex flex-col pt-[60px]">
      {/* Hero Section */}
      <section className="relative bg-mpl-bg text-mpl-text py-16 lg:py-24 overflow-hidden flex-shrink-0 border-b border-mpl-border">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-mpl-bg via-mpl-bg/90 to-transparent z-10" />
          <img 
            src={settings.heroBackgroundImage || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=2000"} 
            alt="Hero Background" 
            className="w-full h-full object-cover opacity-20 filter grayscale"
          />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl bg-gradient-to-br from-[#111] to-[#222] p-8 rounded-xl border border-mpl-border">
            <h1 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-4 uppercase">
              {settings.heroHeading1} <br />
              <span className="text-mpl-accent text-3xl md:text-4xl">{settings.heroHeading2}</span>
            </h1>
            <p className="text-mpl-text-dim text-sm md:text-base mb-8 max-w-lg">
              {settings.heroDescription}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 bg-mpl-accent hover:bg-[#cc0029] text-white px-8 py-3 rounded-md font-semibold transition-colors text-[0.9rem]"
              >
                Shop Now
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 bg-mpl-border flex-shrink-0 border-b border-mpl-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1 text-center bg-mpl-border">
            <div className="p-6 bg-mpl-bg flex flex-col items-center">
              <Star className="w-6 h-6 text-mpl-accent mb-3" />
              <h3 className="font-bold text-[0.9rem] text-mpl-text mb-1 uppercase tracking-wider">Premium Quality</h3>
              <p className="text-xs text-mpl-text-dim">Official authentic materials</p>
            </div>
            <div className="p-6 bg-mpl-bg flex flex-col items-center">
              <Truck className="w-6 h-6 text-mpl-accent mb-3" />
              <h3 className="font-bold text-[0.9rem] text-mpl-text mb-1 uppercase tracking-wider">Fast Delivery</h3>
              <p className="text-xs text-mpl-text-dim">Nationwide shipping coverage</p>
            </div>
            <div className="p-6 bg-mpl-bg flex flex-col items-center">
              <ShieldCheck className="w-6 h-6 text-mpl-accent mb-3" />
              <h3 className="font-bold text-[0.9rem] text-mpl-text mb-1 uppercase tracking-wider">Secure Payment</h3>
              <p className="text-xs text-mpl-text-dim">100% safe checkout</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex-grow bg-mpl-bg"></div>
      
      {/* Footer */}
      <footer className="bg-mpl-bg py-6 border-t border-mpl-border flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[0.75rem] text-mpl-text-dim uppercase tracking-wider">&copy; {new Date().getFullYear()} {settings.storeName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
