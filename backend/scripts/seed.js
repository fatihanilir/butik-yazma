import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { config } from "../src/config.js";
import { query, pool } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const migrationDir = path.resolve(__dirname, "../migrations");
  const migrationFiles = fs.readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort();
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationDir, file), "utf8");
    await query(sql);
  }

  await query("delete from stock_history");
  await query("delete from product_sizes");
  await query("delete from product_images");
  await query("delete from product_colors");
  await query("delete from products");
  await query("delete from categories");
  await query("delete from admin_users");

  const adminHash = await bcrypt.hash(config.adminPassword, 10);
  await query("insert into admin_users(username, password_hash) values($1,$2)", [config.adminUsername, adminHash]);

  const categories = await query(
    "insert into categories(name, slug, description, sort_order, is_active) values ($1,$2,$3,$4,true),($5,$6,$7,$8,true) returning *",
    [
      "Günlük",
      "gunluk",
      "Her gün giyilebilen rahat elbiseler",
      1,
      "Abiye",
      "abiye",
      "Özel günler için şık abiye modelleri",
      2,
    ]
  );

  const gunluk = categories.rows.find((c) => c.slug === "gunluk");
  const abiye = categories.rows.find((c) => c.slug === "abiye");

  const first = await query(
    "insert into products(name, description, price, category_id, status, product_code) values($1,$2,$3,$4,'published',$5) returning *",
    [
      "Gül Desenli Yaz Elbisesi",
      "Hafif kumaşı ve rahat kesimi ile günlük kombinlerde öne çıkar.",
      1299.9,
      gunluk.id,
      "BY-001",
    ]
  );
  const second = await query(
    "insert into products(name, description, price, category_id, status, product_code) values($1,$2,$3,$4,'published',$5) returning *",
    [
      "Saten Gece Elbisesi",
      "Işıltılı dokusu ile davetlerde dikkat çeken modern kesim.",
      2199.9,
      abiye.id,
      "BY-002",
    ]
  );

  const firstColor = await query(
    "insert into product_colors(product_id,color_name,color_hex,sort_order,is_default) values($1,'Standart',null,0,true) returning *",
    [first.rows[0].id]
  );
  const secondColor = await query(
    "insert into product_colors(product_id,color_name,color_hex,sort_order,is_default) values($1,'Standart',null,0,true) returning *",
    [second.rows[0].id]
  );

  await query(
    "insert into product_images(product_id,color_id,url,alt_text,sort_order,is_primary) values ($1,$2,$3,$4,0,true),($5,$6,$7,$8,0,true)",
    [
      first.rows[0].id,
      firstColor.rows[0].id,
      "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=900&q=80",
      "Gül desenli elbise",
      second.rows[0].id,
      secondColor.rows[0].id,
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80",
      "Saten gece elbisesi",
    ]
  );

  for (const [productId, stocks] of [
    [first.rows[0].id, { Standart: 4, M: 2, L: 0 }],
    [second.rows[0].id, { Standart: 1, M: 1, L: 0 }],
  ]) {
    for (const [size, qty] of Object.entries(stocks)) {
      await query("insert into product_sizes(product_id,size_label,stock_quantity) values($1,$2,$3)", [productId, size, qty]);
    }
  }

  await query(
    "update product_sizes ps set color_id=pc.id from product_colors pc where ps.product_id=pc.product_id and pc.is_default=true and ps.color_id is null"
  );

  console.log(`Seed complete: admin=${config.adminUsername}, 2 kategori, 2 urun.`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
