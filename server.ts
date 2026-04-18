import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

// Types
export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  category: string;
  stock: number;
}

export interface Order {
  id: string;
  name: string;
  address: string;
  phone: string;
  productId: string;
  productName: string;
  quantity: number;
  totalPrice: number;
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

// In-Memory Databases
let orders: Order[] = [];
let adminPassword = "admin123";

let products: Product[] = [
  {
    id: "p1",
    name: "MPL Official Pro Jersey",
    price: 350000,
    description: "Premium e-sports jersey with breathable material and official MPL patch.",
    imageUrl: "https://images.unsplash.com/photo-1593030761757-71fae46af504?auto=format&fit=crop&q=80&w=800",
    category: "KAOS",
    stock: 100
  },
  {
    id: "p2",
    name: "MPL Core Black Hoodie",
    price: 450000,
    description: "Comfortable heavyweight hoodie with minimalist MPL embroidery.",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=800",
    category: "KAOS",
    stock: 50
  },
  {
    id: "p3",
    name: "MPL Snapback Cap",
    price: 200000,
    description: "Adjustable snapback cap with 3D puff embroidery MPL logo.",
    imageUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&q=80&w=800",
    category: "Lainnya",
    stock: 200
  },
  {
    id: "p4",
    name: "MPL Gaming Mousepad",
    price: 250000,
    description: "Extended size gaming mousepad with anti-slip rubber base.",
    imageUrl: "https://images.unsplash.com/photo-1616423640778-28d1b53229bd?auto=format&fit=crop&q=80&w=800",
    category: "Lainnya",
    stock: 75
  }
];

let settings: StoreSettings = {
  storeName: "MPL STORE",
  heroHeading1: "ESPORTS WEAR",
  heroHeading2: "Official Merchandise",
  heroDescription: "Support your favorite teams with premium quality apparel and gear. Exclusive collections available now.",
  heroBackgroundImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80",
  themeAccentColor: "#ff0033"
};

// Middleware
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== "Bearer admin-secret-token") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // --- API Routes ---

  // Auth API
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === adminPassword) {
      res.json({ token: "admin-secret-token" });
    } else {
      res.status(401).json({ error: "Username atau Password salah." });
    }
  });

  app.put("/api/auth/password", authMiddleware, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (oldPassword === adminPassword) {
      adminPassword = newPassword;
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Password lama salah." });
    }
  });
  
  // Settings API
  app.get("/api/settings", (req, res) => {
    res.json(settings);
  });
  
  app.put("/api/settings", authMiddleware, (req, res) => {
    settings = { ...settings, ...req.body };
    res.json({ success: true, settings });
  });

  // Products API
  app.get("/api/products", (req, res) => {
    res.json(products);
  });
  
  app.post("/api/products", authMiddleware, (req, res) => {
    const newProduct: Product = {
      id: "p" + Date.now().toString(),
      ...req.body,
    };
    products.push(newProduct);
    res.status(201).json({ success: true, product: newProduct });
  });
  
  app.put("/api/products/:id", authMiddleware, (req, res) => {
    const { id } = req.params;
    const index = products.findIndex((p) => p.id === id);
    if (index !== -1) {
      products[index] = { ...products[index], ...req.body };
      res.json({ success: true, product: products[index] });
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  });

  app.delete("/api/products/:id", authMiddleware, (req, res) => {
    const { id } = req.params;
    products = products.filter((p) => p.id !== id);
    res.json({ success: true });
  });

  // Orders API
  app.post("/api/orders", (req, res) => {
    try {
      const { items } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Keranjang kosong" });
      }

      // Validasi stok
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
          return res.status(404).json({ error: `Produk ${item.productName} tidak ditemukan` });
        }
        if (product.stock < item.quantity) {
          return res.status(400).json({ error: `Stok ${item.productName} tidak mencukupi (Sisa: ${product.stock})` });
        }
      }

      // Deduct stock
      for (const item of items) {
        const productIndex = products.findIndex(p => p.id === item.productId);
        if (productIndex !== -1) {
          products[productIndex].stock -= item.quantity;
        }
      }

      const newOrder: Order = {
        id: Math.random().toString(36).substring(2, 9),
        ...req.body,
        createdAt: new Date().toISOString()
      };
      
      orders.push(newOrder);
      
      if (orders.length > 500) {
        orders = orders.slice(orders.length - 500);
      }
      
      res.status(201).json({ success: true, order: newOrder });
    } catch (err) {
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.get("/api/orders", authMiddleware, (req, res) => {
    res.json(orders.slice().reverse());
  });

  app.delete("/api/orders/:id", authMiddleware, (req, res) => {
    const { id } = req.params;
    orders = orders.filter(o => o.id !== id);
    res.json({ success: true });
  });

  // --- Vite / Frontend Serve ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
