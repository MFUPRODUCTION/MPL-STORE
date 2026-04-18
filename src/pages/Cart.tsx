import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CheckCircle2, ChevronLeft, Trash2 } from "lucide-react";
import { useCart } from "../context/CartContext";

export function Cart() {
  const navigate = useNavigate();
  const { cart, removeFromCart, clearCart, cartTotal, cartCount } = useCart();
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    deliveryMethod: "Kirim",
  });

  const [uniqueCode] = useState(() => Math.floor(100 + Math.random() * 900));
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [completedOrder, setCompletedOrder] = useState<any>(null);

  const totalSurcharge = cart.reduce((sum, item) => sum + (item.surcharge * item.quantity), 0);
  const finalTotal = cartTotal + uniqueCode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setIsLoading(true);
    setError("");

    const orderData = {
      ...formData,
      items: cart,
      totalPrice: cartTotal - totalSurcharge,
      surcharge: totalSurcharge,
      uniqueCode,
      finalTotal,
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat pesanan");

      setCompletedOrder(orderData);
      clearCart();
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess && completedOrder) {
    return (
      <div className="min-h-screen bg-mpl-bg pt-24 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-mpl-surface p-8 rounded-lg border border-mpl-border text-center">
          <div className="w-16 h-16 bg-[#00ff66]/10 text-[#00ff66] rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-mpl-text mb-2 uppercase tracking-wide">Pesanan Berhasil!</h2>
          <p className="text-[0.85rem] text-mpl-text-dim mb-6">
            Terima kasih telah memesan. Silakan lakukan pembayaran ke rekening berikut:
          </p>
          <div className="bg-[#111] p-4 rounded border border-mpl-border mb-6">
            <p className="text-[0.7rem] uppercase tracking-wider text-mpl-text-dim mb-1">Bank JAGO</p>
            <p className="font-mono text-xl text-mpl-accent font-bold mb-1">1019 8712 5831</p>
            <p className="text-[0.8rem] text-mpl-text">a.n. MPL Store</p>
            <div className="mt-4 pt-4 border-t border-[#333]">
              <p className="text-[0.7rem] uppercase tracking-wider text-mpl-text-dim mb-1">Total Transfer (Sesuai Kode Unik)</p>
              <p className="font-bold text-[#00ff66] text-xl">Rp {completedOrder.finalTotal.toLocaleString("id-ID")}</p>
            </div>
          </div>
          <p className="text-[0.8rem] text-mpl-text-dim mb-8">
            Tim kami akan segera menghubungi Anda melalui WhatsApp untuk konfirmasi pengiriman.
          </p>
          <Link
            to="/products"
            className="block w-full bg-mpl-accent hover:bg-[#cc0029] text-white font-semibold py-3 px-4 rounded transition-colors text-[0.85rem]"
          >
            Kembali Belanja
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mpl-bg pt-[100px] pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/products" className="inline-flex items-center text-xs font-medium text-mpl-text-dim hover:text-mpl-text mb-6 uppercase tracking-[0.05em]">
          <ChevronLeft className="w-4 h-4 mr-1" /> Lanjut Belanja
        </Link>
        
        <div className="bg-mpl-surface rounded-lg border border-mpl-border overflow-hidden">
          <div className="p-6 md:p-8">
            <h1 className="text-[0.95rem] font-bold text-mpl-text uppercase tracking-wide mb-6 border-b border-mpl-border pb-4 flex justify-between items-center">
               <span>Keranjang Anda ({cartCount} Barang)</span>
            </h1>
            
            {error && (
              <div className="bg-[#ff0033]/10 border border-[#ff0033]/50 text-[#ff0033] p-4 rounded mb-6 text-sm">
                {error}
              </div>
            )}

            {cart.length === 0 ? (
               <div className="text-center py-16">
                  <p className="text-mpl-text-dim mb-4">Keranjang Anda masih kosong.</p>
                  <Link to="/products" className="bg-[#222] hover:bg-[#333] text-white px-6 py-2.5 rounded font-medium transition-colors text-sm border border-mpl-border">Cari Produk</Link>
               </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-8">
                   {/* Cart Items */}
                   <div className="flex-grow space-y-4">
                      {cart.map((item) => (
                         <div key={item.cartItemId} className="flex gap-4 p-4 border border-mpl-border rounded bg-[#0a0a0a]">
                            <div className="w-20 h-20 bg-[#1a1a1a] rounded flex-shrink-0 overflow-hidden border border-dashed border-[#333]">
                               <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-grow flex flex-col justify-between">
                               <div className="flex justify-between items-start gap-4">
                                  <div>
                                    <div className="text-[0.65rem] font-bold text-mpl-accent uppercase tracking-wider mb-1">{item.productCategory}</div>
                                    <h3 className="font-semibold text-mpl-text text-sm">{item.productName}</h3>
                                    <div className="text-xs text-mpl-text-dim mt-1 space-x-2 flex flex-wrap">
                                       {item.color && <span>Warna: {item.color}</span>}
                                       {item.size && <span>Uk.: {item.size}</span>}
                                       {item.sleeveType && <span>Lengan: {item.sleeveType}</span>}
                                       {item.pdhName && <span className="block w-full mt-1">Nama PDH: {item.pdhName}</span>}
                                    </div>
                                  </div>
                                  <button onClick={() => removeFromCart(item.cartItemId)} className="text-mpl-text-dim hover:text-[#ff0033] p-1">
                                     <Trash2 className="w-4 h-4" />
                                  </button>
                               </div>
                               <div className="flex justify-between items-end mt-2">
                                  <div className="text-xs text-mpl-text-dim">
                                    Qty: <span className="font-bold text-mpl-text">{item.quantity}</span>
                                  </div>
                                  <div className="font-bold text-[#00ff66] text-sm">
                                     Rp {item.itemTotalPrice.toLocaleString("id-ID")}
                                  </div>
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>

                   {/* Checkout Form */}
                   <div className="w-full lg:w-[400px] flex-shrink-0">
                      <div className="bg-[#0a0a0a] border border-mpl-border rounded p-6 sticky top-24">
                         <h3 className="font-bold text-sm text-mpl-text uppercase tracking-wider mb-4 border-b border-mpl-border pb-3">Informasi Pengiriman</h3>
                         <form onSubmit={handleSubmit} className="space-y-4">
                             <div>
                               <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Nama Lengkap</label>
                               <input
                                 type="text" required
                                 className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:outline-none focus:border-mpl-accent"
                                 value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                 placeholder="Budi Santoso"
                               />
                             </div>
                             
                             <div>
                               <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">No. WhatsApp</label>
                               <input
                                 type="tel" required
                                 className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:outline-none focus:border-mpl-accent"
                                 value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                 placeholder="0812xxxx"
                               />
                             </div>

                             <div>
                               <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Metode</label>
                               <select
                                 required
                                 className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:outline-none focus:border-mpl-accent"
                                 value={formData.deliveryMethod} onChange={(e) => setFormData({ ...formData, deliveryMethod: e.target.value })}
                               >
                                 <option value="Kirim">Kirim ke Alamat</option>
                                 <option value="Ambil Ditempat">Ambil di Tempat</option>
                               </select>
                             </div>

                             {formData.deliveryMethod === "Kirim" && (
                               <div>
                                 <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Alamat Lengkap</label>
                                 <textarea
                                   required rows={2}
                                   className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:outline-none focus:border-mpl-accent"
                                   value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                   placeholder="Jl. Sudirman No. 1..."
                                 />
                               </div>
                             )}

                             <div className="pt-4 mt-6 border-t border-mpl-border space-y-2 mb-6">
                               <div className="flex justify-between items-center text-[0.8rem]">
                                 <span className="text-mpl-text-dim">Subtotal Keranjang</span>
                                 <span className="text-mpl-text">Rp {cartTotal.toLocaleString("id-ID")}</span>
                               </div>
                               <div className="flex justify-between items-center text-[0.8rem]">
                                 <span className="text-mpl-text-dim">Kode Unik Transfer</span>
                                 <span className="text-mpl-text font-mono">+ Rp {uniqueCode}</span>
                               </div>
                               <div className="flex justify-between items-center pt-3 mt-2 border-t border-[#333]">
                                 <span className="text-mpl-text-dim text-[0.75rem] uppercase tracking-wider font-bold">Total Final</span>
                                 <span className="text-[1.2rem] font-bold text-[#00ff66]">
                                   Rp {finalTotal.toLocaleString("id-ID")}
                                 </span>
                               </div>
                             </div>

                             <div className="bg-[#ff0033]/10 border border-[#ff0033]/20 rounded p-3 mb-4">
                               <p className="text-[0.65rem] text-mpl-text-dim leading-relaxed text-center">
                                 Pembayaran via transfer Bank JAGO. <br/>
                                 Nominal transfer wajib <span className="font-bold text-mpl-text">pas hingga 3 digit terakhir</span>.
                               </p>
                             </div>

                             <button
                               type="submit"
                               disabled={isLoading}
                               className="w-full bg-mpl-accent hover:bg-[#cc0029] text-white font-semibold py-3 px-4 rounded transition-colors text-[0.85rem] flex justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                             >
                               {isLoading ? "Memproses..." : "Konfirmasi & Checkout"}
                             </button>
                         </form>
                      </div>
                   </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
