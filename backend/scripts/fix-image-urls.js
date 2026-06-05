import { query, pool } from "../src/db.js";

function normalizeStoredImageUrl(value) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/uploads/")) return value;
  if (value.startsWith("uploads/")) return `/${value}`;
  return `/uploads/${value.replace(/^\/+/, "")}`;
}

async function run() {
  const { rows } = await query("select id, url from product_images order by id asc");
  let changed = 0;
  for (const row of rows) {
    const next = normalizeStoredImageUrl(row.url);
    if (next !== row.url) {
      await query("update product_images set url=$1 where id=$2", [next, row.id]);
      changed += 1;
      console.log(`[fix-image-urls] id=${row.id} ${row.url} -> ${next}`);
    }
  }
  console.log(`[fix-image-urls] completed. changed=${changed}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
