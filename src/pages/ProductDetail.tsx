import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { Product, CartItem } from "../types";
import { useCart } from "../context/CartContext";

export function ProductDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productId = searchParams.get("id");
  const { addToCart } = useCart();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    quantity: 1,
    size: "L",
    sleeveType: "Pendek",
    color: "Hitam",
    pdhName: ""
  });

  useEffect(() => {
    fetch("/api/products")
      .then(res => res.json())
      .then(data => {
        const found = data.find((p: Product) => p.id === productId);
        setProduct(found || null);
        setIsLoading(false);
      })
      .catch(console.error);
  }, [productId]);

  if (isLoading) {
    return <div className="min-h-screen bg-mpl-bg pt-32 text-center text-mpl-text-dim">Memuat data produk...</div>;
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-mpl-bg pt-32 text-center">
        <h2 className="text-xl text-mpl-text">Produk tidak ditemukan</h2>
        <Link to="/products" className="text-mpl-accent mt-4 inline-block">Kembali ke Katalog</Link>
      </div>
    );
  }

  const isKaos = product.category.toUpperCase() === "KAOS";
  const isPDH = product.category.toUpperCase() === "PDH";

  const sizeOptions = [
    { label: "S", surcharge: 0 },
    { label: "M", surcharge: 0 },
    { label: "L", surcharge: 0 },
    { label: "XL", surcharge: 0 },
    { label: "2XL", surcharge: 10000 },
    { label: "3XL", surcharge: 20000 },
    { label: "4XL", surcharge: 40000 },
    { label: "5XL", surcharge: 50000 },
  ];
  
  const sleeveOptions = [
    { label: "Pendek", surcharge: 0 },
    { label: "Panjang", surcharge: 10000 },
  ];

  const selectedSizeSurcharge = (isKaos || isPDH) ? (sizeOptions.find(o => o.label === formData.size)?.surcharge || 0) : 0;
  const selectedSleeveSurcharge = isKaos ? (sleeveOptions.find(o => o.label === formData.sleeveType)?.surcharge || 0) : 0;
  const unitSurcharge = selectedSizeSurcharge + selectedSleeveSurcharge;
  const unitTotalPrice = product.price + unitSurcharge;
  const totalPrice = unitTotalPrice * formData.quantity;

  const handleAddToCart = () => {
    const cartItem: CartItem = {
      cartItemId: Math.random().toString(36).substring(2, 9),
      productId: product.id,
      productName: product.name,
      productCategory: product.category,
      productImage: product.imageUrl,
      quantity: formData.quantity,
      size: (isKaos || isPDH) ? formData.size : undefined,
      sleeveType: isKaos ? formData.sleeveType : undefined,
      color: isKaos ? formData.color : undefined,
      pdhName: isPDH ? formData.pdhName : undefined,
      basePrice: product.price,
      surcharge: unitSurcharge,
      itemTotalPrice: totalPrice
    };

    addToCart(cartItem);
    navigate("/cart");
  };

  return (
    <div className="min-h-screen bg-mpl-bg pt-[100px] pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/products" className="inline-flex items-center text-xs font-medium text-mpl-text-dim hover:text-mpl-text mb-6 uppercase tracking-[0.05em]">
          <ChevronLeft className="w-4 h-4 mr-1" /> Kembali ke Katalog
        </Link>
        
        <div className="bg-mpl-surface rounded-lg border border-mpl-border overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 md:p-8">
            {/* Gambar Produk */}
            <div className="relative aspect-square overflow-hidden bg-[#1a1a1a] rounded border border-dashed border-[#333] flex items-center justify-center">
               <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            </div>

            {/* Pilihan Produk */}
            <div className="space-y-6">
              <div>
                 <div className="text-[0.7rem] font-bold text-mpl-accent uppercase tracking-wider mb-2">{product.category}</div>
                 <h1 className="text-2xl font-bold text-mpl-text leading-tight mb-2">{product.name}</h1>
                 <p className="text-[1.3rem] font-bold text-[#00ff66]">Rp {product.price.toLocaleString("id-ID")}</p>
                 <p className="text-mpl-text-dim text-sm mt-4">{product.description}</p>
                 <p className={`text-xs mt-3 font-bold uppercase tracking-wider ${product.stock > 0 ? 'text-[#00ff66]' : 'text-[#ff0033]'}`}>
                    {product.stock > 0 ? `Sisa Stok: ${product.stock}` : 'Stok Habis'}
                 </p>
              </div>

              {(isKaos || isPDH) && (
                <div className="space-y-4 pt-4 border-t border-mpl-border">
                  {isPDH && (
                    <div>
                      <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Nama di PDH</label>
                      <input
                        type="text"
                        required
                        className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:outline-none focus:border-mpl-accent"
                        value={formData.pdhName}
                        onChange={(e) => setFormData({ ...formData, pdhName: e.target.value })}
                        placeholder="Tulis nama yang akan dicetak di PDH"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className={!isKaos ? "col-span-2" : ""}>
                      <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Ukuran</label>
                      <select
                        className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:outline-none focus:border-mpl-accent"
                        value={formData.size}
                        onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      >
                        {sizeOptions.map(opt => (
                          <option key={opt.label} value={opt.label}>
                            {opt.label} {opt.surcharge > 0 ? `(+Rp${opt.surcharge / 1000}k)` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    {isKaos && (
                      <div>
                        <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Model</label>
                        <select
                          className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:outline-none focus:border-mpl-accent"
                          value={formData.sleeveType}
                          onChange={(e) => setFormData({ ...formData, sleeveType: e.target.value })}
                        >
                          {sleeveOptions.map(opt => (
                            <option key={opt.label} value={opt.label}>
                              {opt.label} {opt.surcharge > 0 ? `(+Rp${opt.surcharge / 1000}k)` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  {isKaos && (
                    <div>
                      <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Warna</label>
                      <select
                        className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:outline-none focus:border-mpl-accent"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      >
                        <option value="Hitam">Hitam</option>
                        <option value="Putih">Putih</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-mpl-border">
                <div className="mb-4">
                  <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Jumlah</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      required
                      min="1"
                      max={product.stock}
                      className="block w-24 px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:outline-none focus:border-mpl-accent"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    />
                    <div className="text-mpl-text">
                       <span className="text-mpl-text-dim text-xs">Total:</span> <span className="font-bold">Rp {totalPrice.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={product.stock === 0}
                  className="w-full bg-mpl-accent hover:bg-[#cc0029] text-white font-bold py-3 px-4 rounded transition-colors text-[0.85rem] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {product.stock === 0 ? "Stok Habis" : "Tambahkan ke Keranjang"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
