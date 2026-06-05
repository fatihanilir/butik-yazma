import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "";
const SIZE_OPTIONS = ["Standart", "M", "L"];
const PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='100%' height='100%' fill='%23f1e8ea'/><text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' fill='%238b5e6b' font-size='18'>Butik Yazma</text></svg>";

function createColorBlock(index = 0) {
  return {
    id: null,
    color_name: index === 0 ? "Standart" : "",
    color_hex: "",
    sort_order: index,
    is_default: index === 0,
    images: [],
    sizes: Object.fromEntries(SIZE_OPTIONS.map((s) => [s, 0])),
  };
}

const emptyProduct = {
  id: null,
  name: "",
  description: "",
  price: "",
  product_code: "",
  category_id: "",
  status: "draft",
  colors: [createColorBlock(0)],
};

function parseError(res, fallback) {
  if (typeof res?.message === "string") return res.message;
  return fallback;
}

function normalizeImageUrl(value) {
  if (!value) return PLACEHOLDER;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (!API) return value;
  if (value.startsWith("/uploads/")) return `${API}${value}`;
  if (value.startsWith("uploads/")) return `${API}/${value}`;
  return `${API}/uploads/${value.replace(/^\/+/, "")}`;
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [username, setUsername] = useState("ArdaG");
  const [password, setPassword] = useState("fitcheck");
  const [menu, setMenu] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [dashboard, setDashboard] = useState({});
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: null, name: "", description: "", sort_order: 0, is_active: true });
  const [confirm, setConfirm] = useState({ open: false, title: "", message: "", onConfirm: null });
  const [dragIndex, setDragIndex] = useState(null);
  const [stockDraft, setStockDraft] = useState({});

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 2500);
  }

  async function fetchAuthed(url, options = {}) {
    const res = await fetch(url, { ...options, headers: { ...authHeaders, ...(options.headers || {}) } });
    if (!res.ok) throw await res.json().catch(() => ({ message: "Sunucu hatasi." }));
    return res.status === 204 ? null : res.json();
  }

  async function login(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      localStorage.setItem("token", data.token);
      setToken(data.token);
    } catch (err) {
      showToast("error", parseError(err, "Giris basarisiz."));
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
  }

  async function loadData() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [d, p, c] = await Promise.all([
        fetchAuthed(`${API}/admin/dashboard`),
        fetchAuthed(`${API}/admin/products`),
        fetchAuthed(`${API}/admin/categories`),
      ]);
      const normalizedProducts = p.map((product) => ({
        ...product,
        images: (product.images || []).map((image) => ({ ...image, url: normalizeImageUrl(image.url) })),
        primaryImage: normalizeImageUrl(
          product.primaryImage || product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url
        ),
      }));
      setDashboard(d);
      setProducts(normalizedProducts);
      setCategories(c);
      const stock = {};
      normalizedProducts.forEach((product) => {
        stock[product.id] = {};
        product.sizes.forEach((size) => {
          stock[product.id][size.id] = size.stock_quantity;
        });
      });
      setStockDraft(stock);
    } catch (err) {
      setError(parseError(err, "Veriler yuklenemedi."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  async function uploadImages(colorIndex, files) {
    if (!files.length) return [];
    const color = productForm.colors[colorIndex];
    if ((color?.images?.length || 0) + files.length > 8) {
      showToast("error", "Maksimum 8 gorsel yukleyebilirsiniz.");
      return [];
    }
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    const res = await fetch(`${API}/admin/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
    const data = await res.json();
    if (!res.ok) throw data;
    return data.map((item, index) => ({
      url: normalizeImageUrl(item.url),
      alt_text: productForm.name,
      sort_order: (color?.images?.length || 0) + index,
      is_primary: false,
    }));
  }

  function onDropImages(e, colorIndex) {
    e.preventDefault();
    const files = [...(e.dataTransfer.files || [])];
    handleIncomingFiles(files, colorIndex);
  }

  async function handleIncomingFiles(files, colorIndex) {
    const accepted = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (!accepted.length) return showToast("error", "Sadece JPEG, PNG, WebP desteklenir.");
    try {
      const uploaded = await uploadImages(colorIndex, accepted.slice(0, 8));
      setProductForm((prev) => {
        const colors = [...prev.colors];
        const target = { ...colors[colorIndex] };
        const nextImages = [...target.images, ...uploaded];
        if (!nextImages.some((img) => img.is_primary) && nextImages[0]) nextImages[0].is_primary = true;
        target.images = nextImages;
        colors[colorIndex] = target;
        return { ...prev, colors };
      });
    } catch (err) {
      showToast("error", parseError(err, "Gorsel yuklenemedi."));
    }
  }

  function openCreateProduct() {
    setProductForm({ ...emptyProduct });
    setProductModalOpen(true);
  }

  function openEditProduct(product) {
    const colors = (product.colors?.length ? product.colors : [createColorBlock(0)]).map((color, index) => {
      const sizes = Object.fromEntries(SIZE_OPTIONS.map((size) => [size, 0]));
      (color.sizes || []).forEach((row) => {
        sizes[row.size_label] = row.stock_quantity;
      });
      return {
        id: color.id,
        color_name: color.color_name || (index === 0 ? "Standart" : ""),
        color_hex: color.color_hex || "",
        sort_order: color.sort_order ?? index,
        is_default: Boolean(color.is_default),
        sizes,
        images: [...(color.images || [])].sort((a, b) => a.sort_order - b.sort_order),
      };
    });
    if (!colors.some((c) => c.is_default) && colors[0]) colors[0].is_default = true;
    setProductForm({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price ?? "",
      product_code: product.product_code || "",
      category_id: product.category_id,
      status: product.status,
      colors,
    });
    setProductModalOpen(true);
  }

  function removeImage(colorIndex, imageIndex) {
    setProductForm((prev) => {
      const colors = [...prev.colors];
      const target = { ...colors[colorIndex] };
      const images = target.images.filter((_, i) => i !== imageIndex);
      if (!images.some((img) => img.is_primary) && images[0]) images[0].is_primary = true;
      target.images = images.map((img, sort) => ({ ...img, sort_order: sort }));
      colors[colorIndex] = target;
      return { ...prev, colors };
    });
  }

  function setPrimaryImage(colorIndex, imageIndex) {
    setProductForm((prev) => {
      const colors = prev.colors.map((color, idx) => ({
        ...color,
        is_default: idx === colorIndex,
        images: color.images.map((img, i) => ({ ...img, is_primary: idx === colorIndex && i === imageIndex })),
      }));
      return { ...prev, colors };
    });
  }

  function moveImage(colorIndex, from, to) {
    setProductForm((prev) => {
      const colors = [...prev.colors];
      const target = { ...colors[colorIndex] };
      const items = [...target.images];
      const [picked] = items.splice(from, 1);
      items.splice(to, 0, picked);
      target.images = items.map((img, idx) => ({ ...img, sort_order: idx }));
      colors[colorIndex] = target;
      return { ...prev, colors };
    });
  }

  async function saveProduct(e) {
    e.preventDefault();
    if (!productForm.colors.length) return showToast("error", "En az 1 renk zorunludur.");
    const names = productForm.colors.map((c) => c.color_name.trim().toLowerCase()).filter(Boolean);
    if (names.length !== productForm.colors.length) return showToast("error", "Tum renk adlari girilmeli.");
    if (new Set(names).size !== names.length) return showToast("error", "Ayni renk adi tekrar edemez.");
    if (productForm.colors.some((c) => !c.images.length)) return showToast("error", "Her renk icin en az 1 gorsel zorunlu.");
    if (!productForm.colors.some((c) => c.is_default)) return showToast("error", "Bir varsayilan renk secmelisiniz.");
    const payload = {
      name: productForm.name,
      description: productForm.description,
      price: productForm.price !== "" ? Number(productForm.price) : null,
      product_code: productForm.product_code.trim() || null,
      category_id: Number(productForm.category_id),
      status: productForm.status,
      colors: productForm.colors.map((color, colorIndex) => ({
        color_name: color.color_name,
        color_hex: color.color_hex || null,
        sort_order: colorIndex,
        is_default: color.is_default,
        images: color.images.map((img, i) => ({ ...img, sort_order: i, is_primary: color.is_default && i === 0 })),
        sizes: SIZE_OPTIONS.map((size) => ({ size_label: size, stock_quantity: Number(color.sizes[size] || 0) })),
      })),
    };
    try {
      if (productForm.id) {
        await fetchAuthed(`${API}/admin/products/${productForm.id}`, { method: "PUT", body: JSON.stringify(payload) });
        showToast("success", "Urun guncellendi.");
      } else {
        await fetchAuthed(`${API}/admin/products`, { method: "POST", body: JSON.stringify(payload) });
        showToast("success", "Urun eklendi.");
      }
      setProductModalOpen(false);
      loadData();
    } catch (err) {
      showToast("error", parseError(err, "Kayit islemi basarisiz."));
    }
  }

  function askDeleteProduct(product) {
    setConfirm({
      open: true,
      title: "Urun silinsin mi?",
      message: `${product.name} urunu kalici olarak silinecek.`,
      onConfirm: async () => {
        await fetchAuthed(`${API}/admin/products/${product.id}`, { method: "DELETE" });
        showToast("success", "Urun silindi.");
        loadData();
      },
    });
  }

  function openCreateCategory() {
    setCategoryForm({ id: null, name: "", description: "", sort_order: categories.length + 1, is_active: true });
    setCategoryModalOpen(true);
  }

  function openEditCategory(category) {
    setCategoryForm({ ...category });
    setCategoryModalOpen(true);
  }

  async function saveCategory(e) {
    e.preventDefault();
    try {
      if (categoryForm.id) {
        await fetchAuthed(`${API}/admin/categories/${categoryForm.id}`, {
          method: "PUT",
          body: JSON.stringify(categoryForm),
        });
        showToast("success", "Kategori guncellendi.");
      } else {
        await fetchAuthed(`${API}/admin/categories`, {
          method: "POST",
          body: JSON.stringify(categoryForm),
        });
        showToast("success", "Kategori eklendi.");
      }
      setCategoryModalOpen(false);
      loadData();
    } catch (err) {
      showToast("error", parseError(err, "Kategori kaydedilemedi."));
    }
  }

  function askDeleteCategory(category) {
    setConfirm({
      open: true,
      title: "Kategori silinsin mi?",
      message: `${category.name} kategorisi silinecek.`,
      onConfirm: async () => {
        await fetchAuthed(`${API}/admin/categories/${category.id}`, { method: "DELETE" });
        showToast("success", "Kategori silindi.");
        loadData();
      },
    });
  }

  async function saveStock(product) {
    const updates = product.sizes.map((size) => ({
      id: size.id,
      stock_quantity: Number(stockDraft[product.id]?.[size.id] ?? size.stock_quantity),
    }));
    try {
      await fetchAuthed(`${API}/admin/products/${product.id}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ updates }),
      });
      showToast("success", "Stok guncellendi.");
      loadData();
    } catch (err) {
      showToast("error", parseError(err, "Stok kaydedilemedi."));
    }
  }

  async function bulkZero(productId) {
    try {
      await fetchAuthed(`${API}/admin/stock/bulk-zero`, {
        method: "PATCH",
        body: JSON.stringify({ product_id: productId }),
      });
      showToast("success", "Stoklar sifirlandi.");
      loadData();
    } catch (err) {
      showToast("error", parseError(err, "Toplu stok islemi basarisiz."));
    }
  }

  if (!token) {
    return (
      <form className="login" onSubmit={login}>
        <h1>Butik Yazma Admin</h1>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Kullanici adi" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sifre" />
        <button type="submit">Giris Yap</button>
      </form>
    );
  }

  return (
    <div className="layout">
      <aside className="menu">
        <h2>Butik Yazma</h2>
        {[
          ["dashboard", "Dashboard"],
          ["urunler", "Urunler"],
          ["kategoriler", "Kategoriler"],
          ["stok", "Stok"],
        ].map(([key, label]) => (
          <button key={key} className={menu === key ? "active" : ""} onClick={() => setMenu(key)}>
            {label}
          </button>
        ))}
        <button onClick={logout}>Cikis</button>
      </aside>
      <main className="content">
        {loading && <div className="state">Yukleniyor...</div>}
        {!loading && error && <div className="state error">{error}</div>}
        {!loading && !error && menu === "dashboard" && (
          <section>
            <div className="sectionHead"><h3>Dashboard</h3></div>
            <div className="cards">
              <article><span>Toplam urun</span><strong>{dashboard.total_products || 0}</strong></article>
              <article><span>Yayinda</span><strong>{dashboard.published_products || 0}</strong></article>
              <article><span>Taslak</span><strong>{dashboard.draft_products || 0}</strong></article>
              <article><span>Tukenen beden</span><strong>{dashboard.out_of_stock_sizes || 0}</strong></article>
              <article><span>Dusuk stok</span><strong>{dashboard.low_stock_sizes || 0}</strong></article>
            </div>
            <div className="split">
              <div className="panel"><h4>Son eklenen urunler</h4>{dashboard.recent_products?.length ? dashboard.recent_products.map((item) => <p key={item.id}>{item.name}</p>) : <p className="empty">Veri yok</p>}</div>
              <div className="panel"><h4>Son stok degisiklikleri</h4>{dashboard.recent_stock_changes?.length ? dashboard.recent_stock_changes.map((item) => <p key={item.id}>{item.product_name} / {item.size_label}: {item.old_quantity}→{item.new_quantity}</p>) : <p className="empty">Veri yok</p>}</div>
            </div>
          </section>
        )}
        {!loading && !error && menu === "urunler" && (
          <section>
            <div className="sectionHead"><h3>Urunler</h3><button onClick={openCreateProduct}>Yeni urun</button></div>
            {!products.length ? <p className="empty">Urun bulunamadi.</p> : (
              <div className="table">
                <div className="thead"><span>Gorsel</span><span>Ad</span><span>Kod</span><span>Kategori</span><span>Fiyat</span><span>Durum</span><span>Renk</span><span>Stok</span><span>Islem</span></div>
                {products.map((product) => {
                  const imgSrc = normalizeImageUrl(
                    product.primaryImage || product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url
                  );
                  console.log("[admin.product-list.img]", { id: product.id, primaryImage: product.primaryImage, imgSrc });
                  const stockSum = product.sizes.reduce((sum, size) => sum + size.stock_quantity, 0);
                  return (
                    <div className="row" key={product.id}>
                      <img src={imgSrc} alt="" />
                      <span>{product.name}</span>
                      <span>{product.product_code || "-"}</span>
                      <span>{product.category_name}</span>
                      <span>{product.price != null ? `${Number(product.price).toLocaleString("tr-TR")} TL` : "-"}</span>
                      <span>{product.status === "published" ? "Yayinda" : "Taslak"}</span>
                      <span>{product.colors?.length || 1}</span>
                      <span>{stockSum}</span>
                      <div className="actions">
                        <button onClick={() => openEditProduct(product)}>Duzenle</button>
                        <button onClick={() => setMenu("stok")}>Stok</button>
                        <button className="danger" onClick={() => askDeleteProduct(product)}>Sil</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
        {!loading && !error && menu === "kategoriler" && (
          <section>
            <div className="sectionHead"><h3>Kategoriler</h3><button onClick={openCreateCategory}>Yeni kategori</button></div>
            {!categories.length ? <p className="empty">Kategori bulunamadi.</p> : categories.map((category) => (
              <article className="categoryCard" key={category.id}>
                <div><strong>{category.name}</strong><p>{category.description || "-"}</p></div>
                <div>Siralama: {category.sort_order} | Urun: {category.product_count}</div>
                <div>Durum: {category.is_active ? "Aktif" : "Pasif"}</div>
                <div className="actions"><button onClick={() => openEditCategory(category)}>Duzenle</button><button className="danger" onClick={() => askDeleteCategory(category)}>Sil</button></div>
              </article>
            ))}
          </section>
        )}
        {!loading && !error && menu === "stok" && (
          <section>
            <div className="sectionHead"><h3>Stok Yonetimi</h3></div>
            {!products.length ? <p className="empty">Urun bulunamadi.</p> : products.map((product) => {
              const imgSrc = normalizeImageUrl(
                product.primaryImage || product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url
              );
              return (
                <article className="stockCard" key={product.id}>
                  <img src={imgSrc} alt="" />
                  <div>
                    <h4>{product.name}</h4>
                    <p>{product.category_name}</p>
                    {(product.colors || []).map((color) => (
                      <div key={color.id || color.color_name} className="colorStockBlock">
                        <h5>Renk: {color.color_name}</h5>
                        <div className="sizeGrid">
                          {(color.sizes || []).map((size) => {
                        const value = stockDraft[product.id]?.[size.id] ?? size.stock_quantity;
                        const cls = value === 0 ? "soldout" : value <= 2 ? "low" : "";
                        return (
                          <label key={size.id} className={cls}>
                            {size.size_label}
                            <input
                              type="number"
                              min="0"
                              value={value}
                              onChange={(e) => setStockDraft((prev) => ({
                                ...prev,
                                [product.id]: { ...(prev[product.id] || {}), [size.id]: Number(e.target.value) },
                              }))}
                            />
                          </label>
                        );
                      })}
                        </div>
                      </div>
                    ))}
                    <div className="actions">
                      <button onClick={() => saveStock(product)}>Stok kaydet</button>
                      <button className="danger" onClick={() => bulkZero(product.id)}>Tumunu tukendi yap</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {productModalOpen && (
        <div className="modalBack">
          <form className="modal" onSubmit={saveProduct}>
            <div className="sectionHead"><h3>{productForm.id ? "Urun duzenle" : "Yeni urun"}</h3><button type="button" onClick={() => setProductModalOpen(false)}>Kapat</button></div>
            <input required placeholder="Urun adi" value={productForm.name} onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))} />
            <input placeholder="Urun kodu" value={productForm.product_code} onChange={(e) => setProductForm((prev) => ({ ...prev, product_code: e.target.value }))} />
            <textarea placeholder="Aciklama" value={productForm.description} onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))} />
            <div className="columns">
              <input type="number" placeholder="Fiyat (opsiyonel)" value={productForm.price} onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))} />
              <select required value={productForm.category_id} onChange={(e) => setProductForm((prev) => ({ ...prev, category_id: e.target.value }))}>
                <option value="">Kategori sec</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <select value={productForm.status} onChange={(e) => setProductForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="draft">Taslak</option>
                <option value="published">Yayinda</option>
              </select>
            </div>

            <div className="dropzone" onDrop={onDropImages} onDragOver={(e) => e.preventDefault()}>
              <p>Renkleri asagidan yonetin ve her renk icin gorsel/stok girin.</p>
            </div>
            <div className="actions">
              <button
                type="button"
                onClick={() => setProductForm((prev) => ({ ...prev, colors: [...prev.colors, createColorBlock(prev.colors.length)] }))}
              >
                Renk Ekle
              </button>
            </div>
            {productForm.colors.map((color, colorIndex) => (
              <div key={`${color.id || "new"}-${colorIndex}`} className="colorBlock">
                <div className="columns">
                  <input
                    placeholder="Renk adi"
                    value={color.color_name}
                    onChange={(e) => setProductForm((prev) => {
                      const colors = [...prev.colors];
                      colors[colorIndex] = { ...colors[colorIndex], color_name: e.target.value };
                      return { ...prev, colors };
                    })}
                  />
                  <input
                    type="color"
                    value={color.color_hex || "#8b5e6b"}
                    onChange={(e) => setProductForm((prev) => {
                      const colors = [...prev.colors];
                      colors[colorIndex] = { ...colors[colorIndex], color_hex: e.target.value };
                      return { ...prev, colors };
                    })}
                  />
                  <label className="check">
                    <input
                      type="radio"
                      name="defaultColor"
                      checked={color.is_default}
                      onChange={() => setProductForm((prev) => ({
                        ...prev,
                        colors: prev.colors.map((item, idx) => ({ ...item, is_default: idx === colorIndex })),
                      }))}
                    />
                    Varsayilan
                  </label>
                </div>
                <div className="dropzone" onDrop={(e) => onDropImages(e, colorIndex)} onDragOver={(e) => e.preventDefault()}>
                  <p>{color.color_name || `Renk ${colorIndex + 1}`} icin gorsel yukle (max 8)</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => handleIncomingFiles([...(e.target.files || [])], colorIndex)}
                  />
                </div>
                <div className="thumbs">
                  {color.images.map((image, imageIndex) => (
                    <div
                      key={`${image.url}-${imageIndex}`}
                      className={`thumb ${color.is_default && imageIndex === 0 ? "primary" : ""}`}
                      draggable
                      onDragStart={() => setDragIndex(imageIndex)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex === null || dragIndex === imageIndex) return;
                        moveImage(colorIndex, dragIndex, imageIndex);
                        setDragIndex(null);
                      }}
                    >
                      <img src={normalizeImageUrl(image.url)} alt="" />
                      <div className="actions">
                        <button type="button" onClick={() => setPrimaryImage(colorIndex, imageIndex)}>Ana</button>
                        <button type="button" onClick={() => removeImage(colorIndex, imageIndex)}>Sil</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="sizeGrid">
                  {SIZE_OPTIONS.map((size) => (
                    <label key={`${colorIndex}-${size}`}>
                      {size}
                      <input
                        type="number"
                        min="0"
                        value={color.sizes[size]}
                        onChange={(e) => setProductForm((prev) => {
                          const colors = [...prev.colors];
                          colors[colorIndex] = {
                            ...colors[colorIndex],
                            sizes: { ...colors[colorIndex].sizes, [size]: Number(e.target.value) },
                          };
                          return { ...prev, colors };
                        })}
                      />
                    </label>
                  ))}
                </div>
                {productForm.colors.length > 1 && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => setProductForm((prev) => {
                      const colors = prev.colors.filter((_, idx) => idx !== colorIndex).map((item, idx) => ({ ...item, sort_order: idx }));
                      if (!colors.some((c) => c.is_default) && colors[0]) colors[0].is_default = true;
                      return { ...prev, colors };
                    })}
                  >
                    Rengi Sil
                  </button>
                )}
              </div>
            ))}
            <button type="submit">Kaydet</button>
          </form>
        </div>
      )}

      {categoryModalOpen && (
        <div className="modalBack">
          <form className="modal narrow" onSubmit={saveCategory}>
            <h3>{categoryForm.id ? "Kategori duzenle" : "Yeni kategori"}</h3>
            <input required value={categoryForm.name} onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Kategori adi" />
            <textarea value={categoryForm.description} onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Aciklama" />
            <input type="number" value={categoryForm.sort_order} onChange={(e) => setCategoryForm((prev) => ({ ...prev, sort_order: Number(e.target.value) }))} />
            <label className="check"><input type="checkbox" checked={categoryForm.is_active} onChange={(e) => setCategoryForm((prev) => ({ ...prev, is_active: e.target.checked }))} /> Aktif</label>
            <div className="actions"><button type="submit">Kaydet</button><button type="button" onClick={() => setCategoryModalOpen(false)}>Iptal</button></div>
          </form>
        </div>
      )}

      {confirm.open && (
        <div className="modalBack">
          <div className="modal narrow">
            <h3>{confirm.title}</h3>
            <p>{confirm.message}</p>
            <div className="actions">
              <button
                onClick={async () => {
                  try {
                    await confirm.onConfirm();
                  } catch (err) {
                    showToast("error", parseError(err, "Islem basarisiz."));
                  } finally {
                    setConfirm({ open: false, title: "", message: "", onConfirm: null });
                  }
                }}
              >
                Evet
              </button>
              <button onClick={() => setConfirm({ open: false, title: "", message: "", onConfirm: null })}>Vazgec</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
