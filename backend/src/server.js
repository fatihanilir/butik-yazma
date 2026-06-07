import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import { config } from "./config.js";
import { query } from "./db.js";
import { authRequired } from "./middleware/auth.js";
import { upload } from "./middleware/upload.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (config.corsOrigins.includes("*")) return true;
  if (config.corsOrigins.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (hostname.endsWith(".railway.app")) return true;
    if (hostname === "butikyazmakatalog.com" || hostname.endsWith(".butikyazmakatalog.com")) return true;
  } catch {
    return false;
  }
  return false;
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(config.uploadDir));
const uploadsDir = config.uploadDir;

const SIZE_ORDER = ["Standart", "M", "L"];

function imageUrlFromFile(file) {
  return `/uploads/${file.filename}`;
}

function publicImageUrl(url) {
  return normalizeStoredImageUrl(url);
}

function normalizeStoredImageUrl(value) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/uploads/")) return value;
  if (value.startsWith("uploads/")) return `/${value}`;
  return `/uploads/${value.replace(/^\/+/, "")}`;
}

function filenameFromImageUrl(value) {
  if (!value) return "";
  const normalized = value.startsWith("http") ? new URL(value).pathname : value;
  if (normalized.includes("/uploads/")) return normalized.split("/uploads/").pop();
  return normalized.replace(/^\/+/, "");
}

function ensureColorsPayload(body) {
  if (Array.isArray(body.colors) && body.colors.length) return body.colors;
  return [
    {
      color_name: "Standart",
      color_hex: null,
      is_default: true,
      sort_order: 0,
      images: body.images || [],
      sizes: body.sizes || [],
    },
  ];
}

function validateColorPayload(colors) {
  const names = new Set();
  if (!colors.length) return "En az 1 renk zorunludur.";
  for (const color of colors) {
    const colorName = (color.color_name || "").trim();
    if (!colorName) return "Her renk icin ad zorunludur.";
    const key = colorName.toLowerCase();
    if (names.has(key)) return "Ayni urunde ayni renk adi tekrar edemez.";
    names.add(key);
    if (!Array.isArray(color.images) || !color.images.length) return `${colorName} icin en az 1 gorsel zorunludur.`;
  }
  return null;
}

async function buildProducts(rows) {
  if (!rows.length) return [];
  const ids = rows.map((item) => item.id);
  const [colorsResult, imagesResult, sizesResult] = await Promise.all([
    query("select * from product_colors where product_id = any($1::int[]) order by sort_order asc, id asc", [ids]),
    query("select * from product_images where product_id = any($1::int[]) order by sort_order asc, id asc", [ids]),
    query("select * from product_sizes where product_id = any($1::int[]) order by id asc", [ids]),
  ]);
  const colorsByProduct = new Map();
  colorsResult.rows.forEach((row) => {
    if (!colorsByProduct.has(row.product_id)) colorsByProduct.set(row.product_id, []);
    colorsByProduct.get(row.product_id).push({
      ...row,
      images: [],
      sizes: [],
    });
  });
  const colorById = new Map();
  colorsResult.rows.forEach((row) => colorById.set(row.id, row));

  imagesResult.rows.forEach((row) => {
    const colorId = row.color_id || colorsByProduct.get(row.product_id)?.[0]?.id;
    const targetColor = colorsByProduct.get(row.product_id)?.find((c) => c.id === colorId);
    if (targetColor) targetColor.images.push({ ...row, url: publicImageUrl(row.url) });
  });
  sizesResult.rows.forEach((row) => {
    const colorId = row.color_id || colorsByProduct.get(row.product_id)?.[0]?.id;
    const targetColor = colorsByProduct.get(row.product_id)?.find((c) => c.id === colorId);
    if (targetColor) targetColor.sizes.push(row);
  });
  colorsByProduct.forEach((colorList) => {
    colorList.forEach((color) => {
      color.sizes.sort((a, b) => SIZE_ORDER.indexOf(a.size_label) - SIZE_ORDER.indexOf(b.size_label));
    });
  });

  return rows.map((product) => {
    const colors = colorsByProduct.get(product.id) || [];
    const allImages = colors.flatMap((color) => color.images);
    const primaryImage = publicImageUrl(
      product.primary_image || allImages.find((i) => i.is_primary)?.url || allImages[0]?.url || ""
    );
    return {
      ...product,
      primaryImage,
      images: allImages,
      colors,
      sizes: colors.flatMap((c) => c.sizes),
      color_count: colors.length,
      colorById: undefined,
    };
  });
}

app.get("/health", async (_req, res) => {
  await query("select 1");
  res.json({ ok: true });
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  const { rows } = await query("select * from admin_users where username = $1 limit 1", [username]);
  const admin = rows[0];
  if (!admin) return res.status(401).json({ message: "Kullanici adi veya sifre hatali." });
  const valid = await bcrypt.compare(password || "", admin.password_hash);
  if (!valid) return res.status(401).json({ message: "Kullanici adi veya sifre hatali." });
  const token = jwt.sign({ sub: admin.id, username: admin.username }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.json({ token, user: { username: admin.username } });
});

app.get("/categories", async (_req, res) => {
  const { rows } = await query("select * from categories where is_active=true order by sort_order asc");
  res.json(rows);
});

app.get("/products", async (req, res) => {
  const { category, search, sort } = req.query;
  const clauses = ["1=1", "p.status='published'"];
  const values = [];
  if (category) {
    values.push(category);
    clauses.push(`c.slug = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    clauses.push(`(p.product_code ilike $${values.length} or cast(p.id as text) ilike $${values.length} or p.name ilike $${values.length} or c.name ilike $${values.length})`);
  }
  const order = sort === "price_asc" ? "p.price asc" : sort === "price_desc" ? "p.price desc" : "p.created_at desc";
  const base = await query(
    `select p.*, c.name as category_name, c.slug as category_slug,
      coalesce((select url from product_images pi where pi.product_id=p.id and pi.is_primary=true order by pi.sort_order asc limit 1),
      (select url from product_images pi where pi.product_id=p.id order by pi.sort_order asc limit 1)) as primary_image
     from products p join categories c on c.id=p.category_id where ${clauses.join(" and ")} order by ${order}`,
    values
  );
  res.json(await buildProducts(base.rows));
});

app.get("/products/:id", async (req, res) => {
  const base = await query(
    `select p.*, c.name as category_name, c.slug as category_slug,
      coalesce((select url from product_images pi where pi.product_id=p.id and pi.is_primary=true order by pi.sort_order asc limit 1),
      (select url from product_images pi where pi.product_id=p.id order by pi.sort_order asc limit 1)) as primary_image
     from products p join categories c on c.id=p.category_id where p.id=$1`,
    [req.params.id]
  );
  if (!base.rows[0]) return res.status(404).json({ message: "Urun bulunamadi." });
  const items = await buildProducts(base.rows);
  res.json(items[0]);
});

app.get("/admin/dashboard", authRequired, async (_req, res) => {
  const [counts, recentProducts, stockHistory] = await Promise.all([
    query(
      `select
      (select count(*)::int from products) as total_products,
      (select count(*)::int from products where status='published') as published_products,
      (select count(*)::int from products where status='draft') as draft_products,
      (select count(*)::int from product_sizes where stock_quantity=0) as out_of_stock_sizes,
      (select count(*)::int from product_sizes where stock_quantity>0 and stock_quantity<=2) as low_stock_sizes`
    ),
    query("select p.id, p.name, p.created_at from products p order by p.created_at desc limit 6"),
    query(
      `select sh.id, sh.changed_at, sh.old_quantity, sh.new_quantity, ps.size_label, p.name as product_name
      from stock_history sh join product_sizes ps on ps.id=sh.product_size_id join products p on p.id=ps.product_id
      order by sh.changed_at desc limit 10`
    ),
  ]);
  res.json({ ...counts.rows[0], recent_products: recentProducts.rows, recent_stock_changes: stockHistory.rows });
});

app.get("/admin/products", authRequired, async (_req, res) => {
  const base = await query(
    `select p.*, c.name as category_name,
      coalesce((select url from product_images pi where pi.product_id=p.id and pi.is_primary=true order by pi.sort_order asc limit 1),
      (select url from product_images pi where pi.product_id=p.id order by pi.sort_order asc limit 1)) as primary_image,
      coalesce((select sum(stock_quantity) from product_sizes ps where ps.product_id=p.id),0)::int as stock_total
      from products p join categories c on c.id=p.category_id order by p.created_at desc`
  );
  res.json(await buildProducts(base.rows));
});

app.get("/admin/categories", authRequired, async (_req, res) => {
  const { rows } = await query(
    `select c.*,(select count(*)::int from products p where p.category_id=c.id) as product_count
     from categories c order by c.sort_order asc, c.name asc`
  );
  res.json(rows);
});

app.post("/admin/categories", authRequired, async (req, res) => {
  const { name, description = "", sort_order = 0, is_active = true } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const { rows } = await query(
    "insert into categories(name,slug,description,sort_order,is_active) values($1,$2,$3,$4,$5) returning *",
    [name, slug, description, sort_order, is_active]
  );
  res.status(201).json(rows[0]);
});

app.put("/admin/categories/:id", authRequired, async (req, res) => {
  const { name, description = "", sort_order = 0, is_active = true } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const { rows } = await query(
    "update categories set name=$1,slug=$2,description=$3,sort_order=$4,is_active=$5 where id=$6 returning *",
    [name, slug, description, sort_order, is_active, req.params.id]
  );
  res.json(rows[0]);
});

app.delete("/admin/categories/:id", authRequired, async (req, res) => {
  await query("delete from categories where id=$1", [req.params.id]);
  res.status(204).send();
});

async function saveProductColors(productId, name, colors) {
  let defaultAssigned = false;
  for (let index = 0; index < colors.length; index += 1) {
    const color = colors[index];
    const isDefault = color.is_default || (!defaultAssigned && index === 0);
    if (isDefault) defaultAssigned = true;
    const colorInsert = await query(
      "insert into product_colors(product_id,color_name,color_hex,sort_order,is_default) values($1,$2,$3,$4,$5) returning *",
      [productId, color.color_name, color.color_hex || null, color.sort_order ?? index, isDefault]
    );
    const colorId = colorInsert.rows[0].id;
    for (const [imgIndex, image] of (color.images || []).entries()) {
      const imageUrl = normalizeStoredImageUrl(image.url);
      await query(
        "insert into product_images(product_id,color_id,url,alt_text,sort_order,is_primary) values($1,$2,$3,$4,$5,$6)",
        [productId, colorId, imageUrl, image.alt_text || `${name} ${color.color_name}`, imgIndex, image.is_primary || (isDefault && imgIndex === 0)]
      );
    }
    for (const size of color.sizes || []) {
      await query("insert into product_sizes(product_id,color_id,size_label,stock_quantity) values($1,$2,$3,$4)", [
        productId,
        colorId,
        size.size_label,
        size.stock_quantity,
      ]);
    }
  }
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

app.post("/admin/products", authRequired, async (req, res) => {
  const { name, description = "", price, category_id, status = "draft", product_code = null } = req.body;
  const colors = ensureColorsPayload(req.body);
  const validationError = validateColorPayload(colors);
  if (validationError) return res.status(400).json({ message: validationError });
  const product = await query(
    "insert into products(name,description,price,category_id,status,product_code) values($1,$2,$3,$4,$5,$6) returning *",
    [name, description, normalizePrice(price), category_id, status, product_code || null]
  );
  await saveProductColors(product.rows[0].id, name, colors);
  res.status(201).json(product.rows[0]);
});

app.put("/admin/products/:id", authRequired, async (req, res) => {
  const { name, description = "", price, category_id, status = "draft", product_code = null } = req.body;
  const colors = ensureColorsPayload(req.body);
  const validationError = validateColorPayload(colors);
  if (validationError) return res.status(400).json({ message: validationError });
  await query("update products set name=$1,description=$2,price=$3,category_id=$4,status=$5,product_code=$6,updated_at=now() where id=$7", [
    name,
    description,
    normalizePrice(price),
    category_id,
    status,
    product_code || null,
    req.params.id,
  ]);
  await query("delete from product_images where product_id=$1", [req.params.id]);
  await query("delete from product_sizes where product_id=$1", [req.params.id]);
  await query("delete from product_colors where product_id=$1", [req.params.id]);
  await saveProductColors(req.params.id, name, colors);
  res.json({ ok: true });
});

app.post("/admin/upload", authRequired, upload.array("images", 8), async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ message: "Gorsel yuklenemedi." });
  const payload = files.map((file) => ({ filename: file.filename, url: imageUrlFromFile(file) }));
  res.status(201).json(payload);
});

app.delete("/admin/products/:id/images/:imageId", authRequired, async (req, res) => {
  const { rows } = await query("select * from product_images where id=$1 and product_id=$2", [req.params.imageId, req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: "Gorsel bulunamadi." });
  const fileName = filenameFromImageUrl(rows[0].url);
  if (fileName) {
    const fullPath = path.resolve(uploadsDir, fileName);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
  await query("delete from product_images where id=$1", [req.params.imageId]);
  res.status(204).send();
});

app.patch("/admin/products/:id/stock", authRequired, async (req, res) => {
  const updates = req.body.updates || [];
  for (const row of updates) {
    const old = await query("select stock_quantity from product_sizes where id=$1 and product_id=$2", [row.id, req.params.id]);
    if (!old.rows[0]) continue;
    await query("update product_sizes set stock_quantity=$1 where id=$2 and product_id=$3", [row.stock_quantity, row.id, req.params.id]);
    await query("insert into stock_history(product_size_id, old_quantity, new_quantity, changed_at) values($1,$2,$3,now())", [
      row.id,
      old.rows[0].stock_quantity,
      row.stock_quantity,
    ]);
  }
  res.json({ ok: true });
});

app.patch("/admin/stock/bulk-zero", authRequired, async (req, res) => {
  const { product_id } = req.body;
  const rows = await query("select id, stock_quantity from product_sizes where product_id=$1", [product_id]);
  for (const row of rows.rows) {
    await query("update product_sizes set stock_quantity=0 where id=$1", [row.id]);
    await query("insert into stock_history(product_size_id, old_quantity, new_quantity, changed_at) values($1,$2,0,now())", [row.id, row.stock_quantity]);
  }
  res.json({ ok: true });
});

app.post("/admin/fix-image-urls", authRequired, async (_req, res) => {
  const { rows } = await query("select id, url from product_images order by id asc");
  const changes = [];
  for (const row of rows) {
    const normalized = normalizeStoredImageUrl(row.url);
    if (normalized !== row.url) {
      await query("update product_images set url=$1 where id=$2", [normalized, row.id]);
      changes.push({ id: row.id, from: row.url, to: normalized });
    }
  }
  res.json({ ok: true, changed_count: changes.length, changes });
});

app.delete("/admin/products/:id", authRequired, async (req, res) => {
  await query("delete from products where id=$1", [req.params.id]);
  res.status(204).send();
});

app.listen(config.port, () => {
  console.log(`API ready on port ${config.port}`);
});
