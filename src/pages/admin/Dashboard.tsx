import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Order, Product, StoreSettings } from "../../types";
import { Trash2, LogOut, Loader2, Home as HomeIcon, Download, KeyRound } from "lucide-react";

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"orders" | "products" | "settings">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: "",
    heroHeading1: "",
    heroHeading2: "",
    heroDescription: ""
  });
  
  const [passwordForm, setPasswordForm] = useState({ oldPassword: "", newPassword: "" });
  
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // For product form
  const [productForm, setProductForm] = useState<Partial<Product>>({ category: "KAOS" });
  const [isEditingProduct, setIsEditingProduct] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/admin/login");
      return;
    }
    fetchData();
  }, [navigate, activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    const token = localStorage.getItem("adminToken");
    const headers = { Authorization: `Bearer ${token}` };

    try {
      if (activeTab === "orders") {
        const res = await fetch("/api/orders", { headers });
        if (res.status === 401) throw new Error("Unauthorized");
        setOrders(await res.json());
      } else if (activeTab === "products") {
        const res = await fetch("/api/products");
        setProducts(await res.json());
      } else if (activeTab === "settings") {
        const res = await fetch("/api/settings");
        setSettings(await res.json());
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message === "Unauthorized") {
        localStorage.removeItem("adminToken");
        navigate("/admin/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin/login");
  };

  const deleteOrder = async (id: string) => {
    if (!window.confirm("Yakin ingin menghapus pesanan ini?")) return;
    const token = localStorage.getItem("adminToken");
    await fetch(`/api/orders/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setOrders(orders.filter(o => o.id !== id));
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.imageUrl) {
        alert("Mohon upload gambar produk terlebih dahulu.");
        return;
    }
    const token = localStorage.getItem("adminToken");
    const method = productForm.id ? "PUT" : "POST";
    const url = `/api/products` + (productForm.id ? `/${productForm.id}` : "");
    
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(productForm)
    });
    setProductForm({ category: "KAOS" });
    setIsEditingProduct(false);
    fetchData();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
          alert("Ukuran gambar tidak boleh lebih dari 5MB.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductForm(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHeroImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
          alert("Ukuran gambar tidak boleh lebih dari 5MB.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, heroBackgroundImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!window.confirm("Yakin ingin menghapus produk ini?")) return;
    const token = localStorage.getItem("adminToken");
    const res = await fetch(`/api/products/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      setProducts(products.filter(p => p.id !== id));
    } else {
      alert("Gagal menghapus produk");
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("adminToken");
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(settings)
    });
    alert("Pengaturan disimpan");
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("adminToken");
    const res = await fetch("/api/auth/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(passwordForm)
    });
    const data = await res.json();
    if(res.ok) {
        alert("Password berhasil diubah!");
        setPasswordForm({oldPassword: "", newPassword: ""});
    } else {
        alert(data.error || "Gagal mengubah password");
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Tanggal", "Nama Pemesan", "No. HP", "Alamat", "Metode Pengiriman", 
      "Rincian Produk", "Total Qty", 
      "Total Surcharge", "Kode Unik", "Total Bayar"
    ];
    
    const rows = orders.map(o => {
      const rincianProduk = o.items ? o.items.map(item => 
        `${item.productName} (Qty: ${item.quantity}, Ukuran: ${item.size || '-'}, Warna: ${item.color || '-'}, Lengan: ${item.sleeveType || '-'}, Nama PDH: ${item.pdhName || '-'})`
      ).join(" | ") : "-";

      const totalQty = o.items ? o.items.reduce((sum, item) => sum + item.quantity, 0) : 0;

      return [
        `"${new Date(o.createdAt).toLocaleString('id-ID')}"`,
        `"${o.name}"`,
        `"'${o.phone}"`,
        `"${o.address || "-"}"`,
        `"${o.deliveryMethod || "Kirim"}"`,
        `"${rincianProduk}"`,
        totalQty,
        o.surcharge || 0,
        o.uniqueCode || 0,
        o.finalTotal || o.totalPrice
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Data_Pemesanan_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-mpl-bg text-mpl-text">
      {/* Admin Header */}
      <header className="bg-mpl-surface border-b border-mpl-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[60px] flex justify-between items-center">
          <div className="flex items-center gap-6">
            <span className="font-extrabold text-[1.2rem] tracking-[-0.05em] text-mpl-text uppercase">
              MPL<span className="text-mpl-accent">Admin</span>
            </span>
            <div className="hidden sm:flex gap-4">
              <button onClick={() => setActiveTab("orders")} className={`text-xs font-bold uppercase tracking-wider ${activeTab === 'orders' ? 'text-mpl-text' : 'text-mpl-text-dim hover:text-mpl-text'}`}>Pesanan</button>
              <button onClick={() => setActiveTab("products")} className={`text-xs font-bold uppercase tracking-wider ${activeTab === 'products' ? 'text-mpl-text' : 'text-mpl-text-dim hover:text-mpl-text'}`}>Produk</button>
              <button onClick={() => setActiveTab("settings")} className={`text-xs font-bold uppercase tracking-wider ${activeTab === 'settings' ? 'text-mpl-text' : 'text-mpl-text-dim hover:text-mpl-text'}`}>Pengaturan</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" target="_blank" className="flex items-center gap-1.5 text-mpl-text-dim hover:text-mpl-text transition-colors text-[0.75rem] font-medium uppercase tracking-wider hidden sm:flex">
                <HomeIcon className="w-4 h-4" /> Lihat Situs
            </Link>
            <div className="w-px h-4 bg-mpl-border hidden sm:block"></div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-[#ff0033] hover:text-white transition-colors text-[0.75rem] font-bold uppercase tracking-wider"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
        <div className="px-4 py-2 flex gap-4 sm:hidden bg-[#111] overflow-x-auto border-t border-mpl-border">
            <button onClick={() => setActiveTab("orders")} className={`text-xs font-bold uppercase tracking-wider whitespace-nowrap ${activeTab === 'orders' ? 'text-mpl-text' : 'text-mpl-text-dim hover:text-mpl-text'}`}>Pesanan</button>
            <button onClick={() => setActiveTab("products")} className={`text-xs font-bold uppercase tracking-wider whitespace-nowrap ${activeTab === 'products' ? 'text-mpl-text' : 'text-mpl-text-dim hover:text-mpl-text'}`}>Produk</button>
            <button onClick={() => setActiveTab("settings")} className={`text-xs font-bold uppercase tracking-wider whitespace-nowrap ${activeTab === 'settings' ? 'text-mpl-text' : 'text-mpl-text-dim hover:text-mpl-text'}`}>Pengaturan</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* --- ORDERS TAB --- */}
        {activeTab === "orders" && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-6 gap-4">
              <div>
                <h2 className="text-[0.75rem] font-bold text-mpl-text-dim uppercase tracking-[0.05em] mb-2 flex items-center gap-2">
                  Admin Dashboard <span className="text-[#00ff66] text-[0.6rem]">● LIVE</span>
                </h2>
                <p className="text-mpl-text text-sm">Kelola data pemesanan merchandise.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportToCSV}
                  className="bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/20 hover:bg-[#00ff66]/20 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export Sheet (CSV)
                </button>
                <div className="bg-[#222] px-3 py-1.5 rounded text-xs font-semibold text-mpl-text-dim uppercase tracking-wider border border-mpl-border">
                  Total: {orders.length}
                </div>
              </div>
            </div>

            <div className="bg-mpl-surface rounded-lg border border-mpl-border overflow-hidden">
              <div className="overflow-x-auto p-4 md:p-6">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th scope="col" className="text-left pb-3 text-[0.75rem] font-medium text-mpl-text-dim uppercase tracking-wider border-b border-mpl-border w-[12%]">Tanggal</th>
                      <th scope="col" className="text-left pb-3 text-[0.75rem] font-medium text-mpl-text-dim uppercase tracking-wider border-b border-mpl-border w-[20%]">Pemesan (*Metode)</th>
                      <th scope="col" className="text-left pb-3 text-[0.75rem] font-medium text-mpl-text-dim uppercase tracking-wider border-b border-mpl-border w-[25%]">Produk</th>
                      <th scope="col" className="text-left pb-3 text-[0.75rem] font-medium text-mpl-text-dim uppercase tracking-wider border-b border-mpl-border w-[8%]">Qty</th>
                      <th scope="col" className="text-left pb-3 text-[0.75rem] font-medium text-mpl-text-dim uppercase tracking-wider border-b border-mpl-border w-[20%]">Total Pembayaran</th>
                      <th scope="col" className="text-right pb-3 text-[0.75rem] font-medium text-mpl-text-dim uppercase tracking-wider border-b border-mpl-border w-[10%]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-[0.8rem]">
                    {isLoading ? (
                      <tr><td colSpan={6} className="py-8 text-center text-sm text-mpl-text-dim"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                    ) : orders.length === 0 ? (
                      <tr><td colSpan={6} className="py-8 text-center text-sm text-mpl-text-dim">Belum ada pemesanan.</td></tr>
                    ) : (
                      orders.map((order) => (
                        <tr key={order.id} className="hover:bg-[#181818] transition-colors border-b border-white border-opacity-5">
                          <td className="py-3 pr-4 whitespace-nowrap text-mpl-text-dim">
                            {new Date(order.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="font-semibold text-mpl-text flex items-center gap-1.5">{order.name}</div>
                            <div className="text-mpl-text-dim text-[0.7rem]">{order.phone}</div>
                            <div className="text-[0.65rem] text-mpl-accent font-bold mt-1 uppercase">*( {order.deliveryMethod || "Kirim"} )</div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="space-y-3">
                              {order.items?.map((item, idx) => (
                                <div key={idx} className="bg-[#111] p-2 rounded border border-mpl-border">
                                  <div className="text-mpl-text font-medium text-[0.8rem]">{item.productName} (x{item.quantity})</div>
                                  {(item.size || item.sleeveType || item.color || item.pdhName) && (
                                      <div className="text-mpl-text-dim text-[0.65rem] mt-0.5 uppercase tracking-wider">
                                        {item.color && `[${item.color}] `}
                                        {item.size && `[${item.size}] `}
                                        {item.sleeveType && `[${item.sleeveType}] `}
                                        {item.pdhName && `[Nama: ${item.pdhName}]`}
                                      </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-mpl-text-dim font-bold">
                             {order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} Item
                          </td>
                          <td className="py-3 pr-4 font-bold text-[#00ff66]">
                             [Kode: {order.uniqueCode || "0"}] Rp {(order.finalTotal || order.totalPrice).toLocaleString("id-ID")}
                          </td>
                          <td className="py-3 text-right font-medium">
                            <button onClick={() => deleteOrder(order.id)} className="text-mpl-text-dim hover:text-[#ff0033] p-1.5 transition-colors inline-block bg-[#1a1a1a] rounded border border-[#333]">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- PRODUCTS TAB --- */}
        {activeTab === "products" && (
          <div>
             <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-[0.75rem] font-bold text-mpl-text-dim uppercase tracking-[0.05em] mb-2 flex items-center gap-2">
                  Manajemen Produk
                </h2>
                <p className="text-mpl-text text-sm">Kelola katalog barang merchandise.</p>
              </div>
              {!isEditingProduct && (
                <button 
                  onClick={() => { setProductForm({ name: '', description: '', price: 0, imageUrl: '', category: 'KAOS', stock: 0 }); setIsEditingProduct(true); }}
                  className="bg-mpl-accent hover:bg-[#cc0029] text-white px-4 py-2 rounded text-xs font-bold uppercase transition-colors"
                >
                  + Tambah Produk
                </button>
              )}
            </div>

            {isEditingProduct ? (
              <div className="bg-mpl-surface rounded-lg border border-mpl-border p-6 mb-8">
                <h3 className="font-bold text-mpl-text uppercase tracking-wider mb-4 border-b border-mpl-border pb-2">
                  {productForm.id ? "Edit Produk" : "Tambah Produk Baru"}
                </h3>
                <form onSubmit={saveProduct} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1 uppercase">Nama Produk</label>
                      <input type="text" required value={productForm.name || ""} onChange={(e) => setProductForm({...productForm, name: e.target.value})} className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-sm focus:border-mpl-accent focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1 uppercase">Harga (Rp)</label>
                      <input type="number" required value={productForm.price || ""} onChange={(e) => setProductForm({...productForm, price: Number(e.target.value)})} className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-sm focus:border-mpl-accent focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1 uppercase">Stok</label>
                      <input type="number" required value={productForm.stock || 0} onChange={(e) => setProductForm({...productForm, stock: Number(e.target.value)})} className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-sm focus:border-mpl-accent focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1 uppercase">Kategori</label>
                      <select required value={productForm.category || "KAOS"} onChange={(e) => setProductForm({...productForm, category: e.target.value})} className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-sm focus:border-mpl-accent focus:outline-none">
                         <option value="KAOS">KAOS</option>
                         <option value="SARUNG">SARUNG</option>
                         <option value="KERUDUNG">KERUDUNG</option>
                         <option value="HANDBAG">HANDBAG</option>
                         <option value="PDH">PDH</option>
                         <option value="GANTUNGAN KUNCI">GANTUNGAN KUNCI</option>
                         <option value="TOTE BAG">TOTE BAG</option>
                         <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1 uppercase">Gambar Produk</label>
                      <div className="flex items-center gap-3">
                        {productForm.imageUrl && (
                           <img src={productForm.imageUrl} alt="Preview" className="w-10 h-10 object-cover rounded bg-[#1a1a1a] border border-mpl-border" />
                        )}
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-mpl-text text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#1a1a1a] file:text-mpl-text file:cursor-pointer hover:file:bg-[#222] focus:outline-none" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1 uppercase">Deskripsi</label>
                    <textarea required rows={3} value={productForm.description || ""} onChange={(e) => setProductForm({...productForm, description: e.target.value})} className="block w-full px-3 py-2 border border-mpl-border rounded bg-[#000] text-mpl-text text-sm focus:border-mpl-accent focus:outline-none" />
                  </div>
                  <div className="flex gap-2 justify-end pt-4 border-t border-mpl-border">
                    <button type="button" onClick={() => setIsEditingProduct(false)} className="px-4 py-2 text-xs font-bold uppercase text-mpl-text-dim hover:text-white transition-colors">Batal</button>
                    <button type="submit" className="bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/20 hover:bg-[#00ff66]/20 px-6 py-2 rounded text-xs font-bold uppercase transition-colors">Simpan</button>
                  </div>
                </form>
              </div>
            ) : (
                <div className="bg-mpl-surface rounded-lg border border-mpl-border overflow-hidden">
                <div className="overflow-x-auto p-4 md:p-6">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr>
                        <th scope="col" className="text-left pb-3 text-[0.75rem] font-medium text-mpl-text-dim uppercase tracking-wider border-b border-mpl-border w-[30%]">Produk</th>
                        <th scope="col" className="text-left pb-3 text-[0.75rem] font-medium text-mpl-text-dim uppercase tracking-wider border-b border-mpl-border w-[10%]">Kategori</th>
                        <th scope="col" className="text-left pb-3 text-[0.75rem] font-medium text-mpl-text-dim uppercase tracking-wider border-b border-mpl-border w-[15%]">Harga</th>
                        <th scope="col" className="text-left pb-3 text-[0.75rem] font-medium text-mpl-text-dim uppercase tracking-wider border-b border-mpl-border w-[15%]">Stok</th>
                        <th scope="col" className="text-right pb-3 text-[0.75rem] font-medium text-mpl-text-dim uppercase tracking-wider border-b border-mpl-border w-[30%]">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="text-[0.8rem]">
                      {isLoading ? (
                         <tr><td colSpan={4} className="py-8 text-center text-sm text-mpl-text-dim"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                      ) : products.length === 0 ? (
                        <tr><td colSpan={4} className="py-8 text-center text-sm text-mpl-text-dim">Belum ada produk.</td></tr>
                      ) : (
                        products.map((product) => (
                          <tr key={product.id} className="hover:bg-[#181818] transition-colors border-b border-white border-opacity-5">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-3">
                                <img src={product.imageUrl} alt={product.name} className="w-10 h-10 object-cover rounded bg-[#1a1a1a]" />
                                <div>
                                  <div className="font-semibold text-mpl-text">{product.name}</div>
                                  <div className="text-mpl-text-dim text-[0.65rem] truncate max-w-[200px]" title={product.description}>{product.description}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-mpl-text-dim">{product.category}</td>
                            <td className="py-3 pr-4 font-bold text-mpl-accent">Rp {product.price.toLocaleString("id-ID")}</td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${product.stock > 0 ? 'bg-[#00ff66]/10 text-[#00ff66]' : 'bg-[#ff0033]/10 text-[#ff0033]'}`}>
                                {product.stock > 0 ? `Sisa Stok: ${product.stock}` : 'Habis'}
                              </span>
                            </td>
                            <td className="py-3 text-right font-medium">
                              <button onClick={() => { setProductForm(product); setIsEditingProduct(true); }} className="text-mpl-text-dim hover:text-white p-1.5 transition-colors inline-block bg-[#1a1a1a] rounded border border-[#333] mr-2 text-[0.65rem] uppercase">
                                Edit
                              </button>
                              <button onClick={() => deleteProduct(product.id)} className="text-[#ff0033]/70 hover:text-[#ff0033] p-1.5 transition-colors inline-block bg-[#1a1a1a] rounded border border-[#333] text-[0.65rem] uppercase">
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- SETTINGS TAB --- */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
             <div>
                 <div className="flex justify-between items-end mb-6">
                  <div>
                    <h2 className="text-[0.75rem] font-bold text-mpl-text-dim uppercase tracking-[0.05em] mb-2 flex items-center gap-2">
                      Pengaturan Situs
                    </h2>
                    <p className="text-mpl-text text-sm">Sesuaikan konten hero dan deskripsi website.</p>
                  </div>
                </div>

                <div className="bg-mpl-surface rounded-lg border border-mpl-border p-6">
                  {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-mpl-accent" /></div>
                  ) : (
                    <form onSubmit={saveSettings} className="space-y-6">
                      <div>
                        <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Nama Toko (Header)</label>
                        <input type="text" required value={settings.storeName} onChange={(e) => setSettings({...settings, storeName: e.target.value})} className="block w-full px-3 py-2.5 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:border-mpl-accent focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Hero Banner Heading 1</label>
                        <input type="text" required value={settings.heroHeading1} onChange={(e) => setSettings({...settings, heroHeading1: e.target.value})} className="block w-full px-3 py-2.5 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:border-mpl-accent focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Hero Banner Heading 2 (Aksen Merah)</label>
                        <input type="text" required value={settings.heroHeading2} onChange={(e) => setSettings({...settings, heroHeading2: e.target.value})} className="block w-full px-3 py-2.5 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] text-mpl-accent font-bold focus:border-mpl-accent focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Hero Banner Deskripsi</label>
                        <textarea required rows={4} value={settings.heroDescription} onChange={(e) => setSettings({...settings, heroDescription: e.target.value})} className="block w-full px-3 py-2.5 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:border-mpl-accent focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Background Gambar Depan</label>
                        <div className="flex flex-col gap-3">
                          {settings.heroBackgroundImage && (
                             <img src={settings.heroBackgroundImage} alt="Hero Preview" className="w-full h-32 object-cover rounded opacity-80 border border-mpl-border" />
                          )}
                          <input type="file" accept="image/*" onChange={handleHeroImageUpload} className="block w-full text-mpl-text text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#1a1a1a] file:text-mpl-text file:cursor-pointer hover:file:bg-[#222] focus:outline-none bg-[#000] border border-mpl-border rounded p-2" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider flex justify-between items-center">
                          <span>Warna Tema (Aksen)</span>
                          <span className="text-[0.6rem] font-mono text-mpl-text-dim">{settings.themeAccentColor}</span>
                        </label>
                        <div className="flex gap-4 items-center">
                          <input type="color" value={settings.themeAccentColor || "#ff0033"} onChange={(e) => setSettings({...settings, themeAccentColor: e.target.value})} className="w-12 h-12 rounded cursor-pointer border-none bg-transparent" />
                          <p className="text-[0.7rem] leading-relaxed text-mpl-text-dim">Pilih warna untuk tombol / aksen teks website.</p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-mpl-border flex justify-end">
                        <button type="submit" className="bg-mpl-accent hover:bg-[#cc0029] text-white px-8 py-3 rounded text-[0.8rem] font-bold uppercase tracking-wider transition-colors">
                          Simpan Perubahan
                        </button>
                      </div>
                    </form>
                  )}
                </div>
            </div>

            <div>
                 <div className="flex justify-between items-end mb-6">
                  <div>
                    <h2 className="text-[0.75rem] font-bold text-mpl-text-dim uppercase tracking-[0.05em] mb-2 flex items-center gap-2">
                       Akses Keamanan
                    </h2>
                    <p className="text-mpl-text text-sm">Ganti password administrator.</p>
                  </div>
                </div>

                <div className="bg-mpl-surface rounded-lg border border-mpl-border p-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5">
                      <KeyRound className="w-24 h-24" />
                   </div>
                   <form onSubmit={changePassword} className="space-y-6 relative z-10">
                      <div>
                        <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Password Lama</label>
                        <input type="password" required placeholder="********" value={passwordForm.oldPassword} onChange={(e) => setPasswordForm({...passwordForm, oldPassword: e.target.value})} className="block w-full px-3 py-2.5 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:border-mpl-accent focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[0.65rem] font-medium text-mpl-text-dim mb-1.5 uppercase tracking-wider">Password Baru</label>
                        <input type="password" minLength={6} placeholder="Minimal 6 Karakter" required value={passwordForm.newPassword} onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})} className="block w-full px-3 py-2.5 border border-mpl-border rounded bg-[#000] text-mpl-text text-[0.8rem] focus:border-mpl-accent focus:outline-none" />
                      </div>
                       <div className="pt-4 border-t border-mpl-border flex justify-end">
                        <button type="submit" className="bg-[#222] border border-[#333] hover:bg-[#333] text-white px-8 py-3 rounded text-[0.8rem] font-bold uppercase tracking-wider transition-colors">
                          Update Password
                        </button>
                      </div>
                   </form>
                </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
