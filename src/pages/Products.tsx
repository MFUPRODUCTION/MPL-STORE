import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Product } from "../types";

export function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(console.error);
  }, []);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-mpl-bg pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-mpl-text tracking-[-0.02em] uppercase">Featured Drops</h1>
            <p className="text-mpl-text-dim mt-1 text-sm">All official products in one place.</p>
          </div>
          
          <div className="relative max-w-sm w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-mpl-text-dim" />
            </div>
            <input
              type="text"
              placeholder="Search products..."
              className="block w-full pl-9 pr-3 py-2 bg-[#000] border border-mpl-border rounded text-[0.8rem] text-mpl-text focus:outline-none focus:border-mpl-accent placeholder-mpl-text-dim"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-mpl-surface rounded-lg border border-mpl-border">
            <h3 className="text-[0.9rem] font-medium text-mpl-text">No products found</h3>
            <p className="text-mpl-text-dim mt-1 text-sm">Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-mpl-surface border border-mpl-border p-4 rounded-lg flex flex-col transition-colors hover:border-[#444]">
                <div className="relative aspect-square overflow-hidden bg-[#1a1a1a] rounded mb-3 flex items-center justify-center border border-dashed border-[#333] flex-shrink-0">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-col flex-grow">
                  <div className="text-[0.65rem] font-semibold text-mpl-text-dim uppercase tracking-[0.05em] mb-1">
                    {product.category}
                  </div>
                  <h3 className="font-semibold text-[0.9rem] text-mpl-text mb-1 line-clamp-2" title={product.name}>
                    {product.name}
                  </h3>
                  <p className="text-[0.75rem] text-mpl-text-dim mb-4 line-clamp-2 flex-grow">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="font-bold text-mpl-accent text-[0.9rem]">
                      Rp {product.price.toLocaleString("id-ID")}
                    </span>
                    <span className={`text-[0.65rem] font-bold uppercase tracking-wider ${product.stock > 0 ? 'text-[#00ff66]' : 'text-[#ff0033]'}`}>
                      {product.stock > 0 ? `Sisa Stok: ${product.stock}` : 'Habis'}
                    </span>
                  </div>
                  {product.stock > 0 ? (
                    <Link
                      to={`/product?id=${product.id}`}
                      className="w-full p-2.5 bg-mpl-accent hover:bg-[#cc0029] text-white rounded text-[0.85rem] font-semibold text-center block mt-3 transition-colors"
                    >
                      Beli Sekarang
                    </Link>
                  ) : (
                    <button disabled className="w-full p-2.5 bg-[#222] text-[#555] rounded text-[0.85rem] font-semibold text-center block mt-3 cursor-not-allowed border border-[#333]">
                      Stok Habis
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
