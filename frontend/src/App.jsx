import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";

const API = import.meta.env.VITE_API_URL ?? "";
const PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='800'><rect width='100%' height='100%' fill='%23f1e8ea'/><text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' fill='%238b5e6b' font-size='24'>Butik Yazma</text></svg>";

function normalizeImageUrl(value) {
  if (!value) return PLACEHOLDER;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (!API) return value;
  if (value.startsWith("/uploads/")) return `${API}${value}`;
  if (value.startsWith("uploads/")) return `${API}/${value}`;
  return `${API}/uploads/${value.replace(/^\/+/, "")}`;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSize(size) {
  const raw = size && typeof size === "object" ? size : {};
  return {
    ...raw,
    stock_quantity: toNumberOrNull(raw.stock_quantity) ?? 0,
  };
}

function normalizeProduct(product) {
  const safe = product && typeof product === "object" ? product : {};

  const images = (Array.isArray(safe.images) ? safe.images : []).map((image) => ({
    ...image,
    url: normalizeImageUrl(image?.url),
  }));

  const colors = (Array.isArray(safe.colors) ? safe.colors : []).map((color) => {
    const safeColor = color && typeof color === "object" ? color : {};
    return {
      ...safeColor,
      images: (Array.isArray(safeColor.images) ? safeColor.images : []).map((img) => ({
        ...img,
        url: normalizeImageUrl(img?.url),
      })),
      sizes: (Array.isArray(safeColor.sizes) ? safeColor.sizes : []).map(normalizeSize),
    };
  });

  const sizes = (Array.isArray(safe.sizes) ? safe.sizes : []).map(normalizeSize);

  const primaryImage = normalizeImageUrl(
    safe.primaryImage || safe.primary_image || images.find((i) => i?.is_primary)?.url || images[0]?.url
  );

  return {
    ...safe,
    images,
    colors,
    sizes,
    price: toNumberOrNull(safe.price),
    category_name: safe.category_name ?? safe.categoryName ?? null,
    primaryImage,
  };
}

function colorHexOrFallback(color) {
  const hex = (color?.color_hex || "").trim();
  if (/^#[0-9A-Fa-f]{3,8}$/.test(hex)) return hex;
  const map = {
    standart: "#c7b7bd",
    siyah: "#1f1f1f",
    beyaz: "#f4f4f4",
    lacivert: "#1b2a52",
    kirmizi: "#b3261e",
    mavi: "#2864b6",
    yesil: "#2f7a4c",
    sari: "#d8ac1e",
    pembe: "#c86b85",
    mor: "#7052a8",
    gri: "#7d7d83",
    kahverengi: "#7a5239",
  };
  return map[(color?.color_name || "").trim().toLowerCase()] || "#b69aa2";
}

function statusText(size) {
  if (size.stock_quantity === 0) return "Tukendi";
  return "Stokta";
}

function Layout({ children }) {
  return (
    <main className="page">
      <header className="topbar">
        <Link className="logo" to="/">Butik Yazma</Link>
        <div className="contact">
          <a href="https://www.instagram.com/butikyazma/" target="_blank" rel="noreferrer" aria-label="Instagram">⌁ Instagram</a>
          <a href="tel:02123250258" aria-label="Telefon">☎ 0212 325 02 58</a>
        </div>
      </header>
      {children}
      <footer className="footer">
        <a href="https://www.instagram.com/butikyazma/" target="_blank" rel="noreferrer">⌁ @butikyazma</a>
        <a href="tel:02123250258">☎ 0212 325 02 58</a>
      </footer>
    </main>
  );
}

function ProductCard({ product }) {
  const images = product.images?.length ? product.images : [{ url: product.primaryImage, alt_text: product.name }];
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    setCanHover(typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches);
  }, []);

  useEffect(() => {
    if (!canHover || !isHovered || images.length <= 1) return undefined;
    const starter = setTimeout(() => {
      setActiveImageIndex((prev) => (prev + 1) % images.length);
    }, 2000);
    return () => clearTimeout(starter);
  }, [canHover, isHovered, images.length, activeImageIndex]);

  const imgSrc = normalizeImageUrl(images[activeImageIndex]?.url || product.primaryImage);
  console.log("[frontend.product-card.img]", { id: product.id, primaryImage: product.primaryImage, imgSrc });
  const out = product.sizes?.every((x) => x.stock_quantity === 0);
  return (
    <Link className="cardLink" to={`/urun/${product.id}`}>
      <motion.article
        className="card"
        whileHover={{ y: -6 }}
        transition={{ duration: 0.22 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <h3 className="cardTitle">{product.name}</h3>
        <div className="cardImageWrap">
          <AnimatePresence mode="wait">
            <motion.img
              key={`${product.id}-${activeImageIndex}`}
              src={imgSrc}
              alt={images[activeImageIndex]?.alt_text || product.name}
              loading="lazy"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.26 }}
            />
          </AnimatePresence>
          {out && <span className="badge">Tukendi</span>}
          {images.length > 1 && (
            <div className="cardDots" onClick={(e) => e.preventDefault()}>
              {images.map((_, index) => (
                <button
                  key={`${product.id}-dot-${index}`}
                  className={`cardDot ${index === activeImageIndex ? "active" : ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveImageIndex(index);
                  }}
                  aria-label={`${index + 1}. gorsel`}
                />
              ))}
            </div>
          )}
        </div>
        <p>{product.category_name}</p>
      </motion.article>
    </Link>
  );
}

function HomePage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/categories`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Categories request failed");
        const payload = await r.json();
        const categoryList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.categories)
            ? payload.categories
            : Array.isArray(payload.data)
              ? payload.data
              : [];
        setCategories(categoryList);
      })
      .catch((error) => {
        console.error("Categories load error:", error);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (activeCategory) params.set("category", activeCategory);
    if (searchQuery) params.set("search", searchQuery);
    fetch(`${API}/products?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Products request failed");
        const payload = await r.json();
        const productList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.products)
            ? payload.products
            : Array.isArray(payload.data)
              ? payload.data
              : [];
        const safeProducts = productList
          .map((item) => {
            try {
              return normalizeProduct(item);
            } catch (error) {
              console.error("Product normalize error:", item, error);
              return null;
            }
          })
          .filter(Boolean);
        setProducts(safeProducts);
      })
      .catch((error) => {
        console.error("Products load error:", error);
        setError("Urunler yuklenemedi.");
      })
      .finally(() => setLoading(false));
  }, [activeCategory, searchQuery]);

  function runSearch() {
    setSearchQuery(searchInput.trim());
  }

  return (
    <>
      <motion.section className="hero" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p>Zarif ve modern kadin butik koleksiyonu</p>
        <h2>Sezonun one cikan elbiseleri</h2>
      </motion.section>
      <section className="filters">
        <div className="searchRow">
          <input
            placeholder="Urun numarasi ara"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <button type="button" onClick={runSearch}>Ara</button>
        </div>
        <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)}>
          <option value="">Tum kategoriler</option>
          {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
        </select>
      </section>
      {loading && <div className="state">Yukleniyor...</div>}
      {error && <div className="state error">{error}</div>}
      {!loading && !error && !products.length && <div className="state">Urun bulunamadi.</div>}
      <section className="grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</section>
    </>
  );
}

function DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [selectedColorId, setSelectedColorId] = useState("all");
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  useEffect(() => {
    setLoading(true);
    Promise.all([fetch(`${API}/products/${id}`).then((r) => r.json()), fetch(`${API}/products`).then((r) => r.json())])
      .then(([detail, all]) => {
        setProduct(normalizeProduct(detail));
        setAllProducts(all.map(normalizeProduct));
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", () => setSelected(emblaApi.selectedScrollSnap()));
  }, [emblaApi]);

  useEffect(() => {
    if (selected > 0 && selected >= (activeColor ? activeColor.images?.length || 0 : product?.images?.length || 0)) {
      setSelected(0);
      emblaApi?.scrollTo(0);
    }
  }, [selectedColorId]);

  useEffect(() => {
    if (!zoomOpen) return undefined;
    const onEsc = (event) => {
      if (event.key === "Escape") setZoomOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [zoomOpen]);

  if (loading) return <div className="state">Detay yukleniyor...</div>;
  if (!product?.id) return <div className="state error">Urun bulunamadi.</div>;

  const colors = product.colors || [];
  const activeColor = selectedColorId === "all" ? null : colors.find((c) => String(c.id) === String(selectedColorId));
  const images = activeColor ? activeColor.images || [] : product.images || [];
  const similar = allProducts.filter((item) => item.id !== product.id && item.category_id === product.category_id).slice(0, 4);
  const visibleSizes = activeColor ? activeColor.sizes || [] : [];

  return (
    <>
      <button className="backBtn" onClick={() => navigate(-1)}>← Geri</button>
      <h2 className="detailMobileTitle">{product.name}</h2>
      <section className="detail">
        <div className="gallery">
          <div className="embla" ref={emblaRef}>
            <div className="emblaContainer">
              {images.map((image, index) => (
                <motion.img
                  key={image.id || index}
                  className={`emblaSlide ${index === selected ? "active" : ""}`}
                  src={normalizeImageUrl(image.url)}
                  alt={image.alt_text || product.name}
                  initial={{ opacity: 0.5, x: 10 }}
                  animate={{ opacity: index === selected ? 1 : 0.6, x: 0 }}
                  transition={{ duration: 0.28 }}
                />
              ))}
            </div>
            {images.length > 1 && (
              <>
                <button className="overlayNav left" onClick={() => emblaApi?.scrollPrev()} aria-label="Onceki gorsel">
                  ←
                </button>
                <button className="overlayNav right" onClick={() => emblaApi?.scrollNext()} aria-label="Sonraki gorsel">
                  →
                </button>
              </>
            )}
            <button className="overlayZoom" onClick={() => setZoomOpen(true)} aria-label="Gorseli buyut">
              🔍
            </button>
            {images.length > 1 && (
              <div className="overlayDots" role="tablist" aria-label="Gorsel secimi">
                {images.map((image, index) => (
                  <button
                    key={`${image.id || index}-overlay-dot`}
                    className={`dot ${index === selected ? "active" : ""}`}
                    onClick={() => emblaApi?.scrollTo(index)}
                    aria-label={`${index + 1}. gorsel`}
                  />
                ))}
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="thumbStrip">
              {images.map((image, index) => (
                <button
                  key={`${image.id || index}-thumb`}
                  className={`thumbItem ${index === selected ? "active" : ""}`}
                  onClick={() => emblaApi?.scrollTo(index)}
                  aria-label={`${index + 1}. gorsel`}
                >
                  <img src={normalizeImageUrl(image.url)} alt={image.alt_text || product.name} />
                </button>
              ))}
            </div>
          )}
        </div>
        <article className="detailInfo">
          <h2 className="detailDesktopTitle">{product.name}</h2>
          <p>{product.description}</p>
          <span className="catTag">{product.category_name}</span>
          {colors.length > 0 && (
            <div className="colorRow">
              {colors.map((color) => (
                <button
                  key={color.id}
                  className={`colorSwatch ${String(selectedColorId) === String(color.id) ? "active" : ""}`}
                  style={{ backgroundColor: colorHexOrFallback(color) }}
                  title={color.color_name}
                  aria-label={color.color_name}
                  onClick={() => {
                    setSelectedColorId(color.id);
                    setSelected(0);
                    emblaApi?.scrollTo(0);
                  }}
                />
              ))}
              <button
                className={`colorPill ${selectedColorId === "all" ? "active" : ""}`}
                onClick={() => setSelectedColorId("all")}
                title="Tum gorseller"
              >
                Tumu
              </button>
            </div>
          )}
          {activeColor && (
            <span className="colorLabel">{activeColor.color_name}</span>
          )}
          <div className="sizes">
            {selectedColorId === "all" && <span>Renk seciniz</span>}
            {selectedColorId !== "all" && visibleSizes.map((size) => (
              <span key={size.id} className={size.stock_quantity === 0 ? "off" : ""}>
                {size.size_label} - {statusText(size)}
              </span>
            ))}
          </div>
          <a className="cta" href="https://www.instagram.com/butikyazma/" target="_blank" rel="noreferrer">Siparis icin DM</a>
        </article>
      </section>
      {zoomOpen && (
        <div className="zoomBack" onClick={() => setZoomOpen(false)}>
          <div className="zoomModal" onClick={(e) => e.stopPropagation()}>
            <button className="zoomClose" onClick={() => setZoomOpen(false)} aria-label="Kapat">X</button>
            <img src={normalizeImageUrl(images[selected]?.url || product.primaryImage)} alt="" />
          </div>
        </div>
      )}
      <section>
        <h3 className="similarTitle">Bu elbiselere de bakmis miydiniz?</h3>
        <div className="grid">{similar.length ? similar.map((item) => <ProductCard key={item.id} product={item} />) : <p>Benzer urun bulunamadi.</p>}</div>
      </section>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/urun/:id" element={<DetailPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
