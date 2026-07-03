import { useEffect, useRef, useState } from "react";
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

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "Toptan alım için fiyat sorunuz.";
  let num = Number(value);
  if (!Number.isFinite(num)) num = 0;
  return `${num.toLocaleString("tr-TR")} TL`;
}

function hasListedPrice(value) {
  return value !== null && value !== undefined && value !== "";
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

function visibleSizeGroup(sizes = []) {
  const standardSizes = sizes.filter((size) => size.size_label === "Standart");
  const letterSizes = sizes.filter((size) => ["M", "L"].includes(size.size_label));
  const hasStandardStock = standardSizes.some((size) => size.stock_quantity > 0);
  const hasLetterStock = letterSizes.some((size) => size.stock_quantity > 0);

  if (hasLetterStock) return letterSizes;
  if (hasStandardStock) return standardSizes;
  if (letterSizes.length) return letterSizes;
  return sizes;
}

function isSoldOut(sizes = []) {
  if (!sizes.length) return false;
  return !sizes.some((size) => size.stock_quantity > 0);
}

function colorForImage(image, colors = []) {
  if (!image) return null;
  if (image.color_id != null) {
    return colors.find((color) => String(color.id) === String(image.color_id)) || null;
  }
  return colors.find((color) => color.images?.some((img) => String(img.id) === String(image.id))) || null;
}

function gallerySoldOut({ colors, activeColor, showColorPicker, images, selectedIndex, productSizes }) {
  if (activeColor) return isSoldOut(activeColor.sizes);
  if (!showColorPicker) return isSoldOut(productSizes);
  const currentImage = images[selectedIndex ?? 0];
  const imageColor = colorForImage(currentImage, colors);
  if (imageColor) return isSoldOut(imageColor.sizes);
  return isSoldOut(productSizes);
}

function InstagramIcon() {
  return (
    <svg className="socialIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8Zm4.2 3.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6Zm0 2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm5.05-2.35a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z" />
    </svg>
  );
}

function Layout({ children }) {
  return (
    <main className="page">
      <header className="topbar">
        <Link className="logo" to="/">Butik Yazma</Link>
        <div className="contact">
          <a className="socialLink" href="https://www.instagram.com/butikyazma/" target="_blank" rel="noreferrer" aria-label="Instagram"><InstagramIcon /> Instagram</a>
          <a href="tel:02123250258" aria-label="Telefon">☎ 0212 325 02 58</a>
        </div>
      </header>
      {children}
      <footer className="footer">
        <a className="socialLink" href="https://www.instagram.com/butikyazma/" target="_blank" rel="noreferrer"><InstagramIcon /> @butikyazma</a>
        <a href="tel:02123250258">☎ 0212 325 02 58</a>
      </footer>
    </main>
  );
}

function ProductCard({ product }) {
  const images = product.images?.length ? product.images : [{ url: product.primaryImage, alt_text: product.name }];
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef(null);
  const didSwipe = useRef(false);
  const hasSlider = images.length > 1;
  const productCode = product.product_code || product.productCode || product.id;

  useEffect(() => {
    if (!hasSlider || isHovered) return undefined;
    const timer = setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [hasSlider, isHovered, images.length]);

  function goToImage(index, event) {
    event?.preventDefault();
    event?.stopPropagation();
    setActiveImageIndex((index + images.length) % images.length);
  }

  function onTouchEnd(event) {
    if (touchStartX.current === null || !hasSlider) return;
    const diff = touchStartX.current - event.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(diff) < 35) return;
    didSwipe.current = true;
    setActiveImageIndex((prev) => (diff > 0 ? prev + 1 : prev - 1 + images.length) % images.length);
  }

  const imgSrc = normalizeImageUrl(images[activeImageIndex]?.url || product.primaryImage);
  const out = product.sizes?.every((x) => x.stock_quantity === 0);
  return (
    <Link
      className="cardLink"
      to={`/urun/${product.id}`}
      onClick={(event) => {
        if (!didSwipe.current) return;
        event.preventDefault();
        didSwipe.current = false;
      }}
    >
      <motion.article
        className="card"
        whileHover={{ y: -6 }}
        transition={{ duration: 0.22 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="cardImageWrap"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0].clientX;
          }}
          onTouchEnd={onTouchEnd}
        >
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
          {hasSlider && (
            <>
              <button className="cardArrow left" type="button" onClick={(event) => goToImage(activeImageIndex - 1, event)} aria-label="Onceki gorsel">‹</button>
              <button className="cardArrow right" type="button" onClick={(event) => goToImage(activeImageIndex + 1, event)} aria-label="Sonraki gorsel">›</button>
              <div className="cardDots" onClick={(e) => e.preventDefault()}>
              {images.map((_, index) => (
                <button
                  key={`${product.id}-dot-${index}`}
                  className={`cardDot ${index === activeImageIndex ? "active" : ""}`}
                  onClick={(event) => goToImage(index, event)}
                  aria-label={`${index + 1}. gorsel`}
                />
              ))}
              </div>
            </>
          )}
        </div>
        <div className="cardBody">
          <h3 className="cardTitle">{product.name}</h3>
          <p className="cardCategory">{product.category_name}</p>
          {productCode && <span className="productCode">Urun Kodu: {productCode}</span>}
        </div>
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
        <p>YAZIN ENERJİSİNİ TAŞIYAN OTANTİK TASARIMLAR</p>
        <h2>Rahat, renkli ve özgür...</h2>
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
      <p className="aiDisclaimer">Görsellerde yapay zekâ ile oluşturulmuş dijital model kullanılmıştır.</p>
      <section className="grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</section>
      <p className="aiDisclaimer aiDisclaimerBottom">Görsellerde yapay zekâ ile oluşturulmuş dijital model kullanılmıştır.</p>
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
        const normalizedDetail = normalizeProduct(detail);
        const defaultColor = normalizedDetail.colors?.find((color) => color.is_default) || normalizedDetail.colors?.[0];
        setProduct(normalizedDetail);
        setAllProducts(all.map(normalizeProduct));
        setSelectedColorId(defaultColor?.id ?? "all");
        setSelected(0);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", () => setSelected(emblaApi.selectedScrollSnap()));
  }, [emblaApi]);

  useEffect(() => {
    if (!product) return;
    const color = selectedColorId === "all" ? null : product.colors?.find((c) => String(c.id) === String(selectedColorId));
    const imageList = color?.images?.length ? color.images : product.images || [];
    if (selected > 0 && selected >= imageList.length) {
      setSelected(0);
      emblaApi?.scrollTo(0);
    }
  }, [selectedColorId, product, selected, emblaApi]);

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
  const images = activeColor ? activeColor.images?.length ? activeColor.images : product.images || [] : product.images || [];
  const similar = allProducts.filter((item) => item.id !== product.id && item.category_id === product.category_id).slice(0, 4);
  const showColorPicker = colors.length > 1;
  const showSizes = selectedColorId !== "all" && activeColor;
  const visibleSizes = showSizes ? visibleSizeGroup(activeColor.sizes || []) : [];
  const showSoldOutBadge = gallerySoldOut({
    colors,
    activeColor,
    showColorPicker,
    images,
    selectedIndex: selected,
    productSizes: product.sizes,
  });
  const listedPrice = hasListedPrice(product.price);

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
            {showSoldOutBadge && <span className="badge">Tukendi</span>}
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
          <p className="aiDisclaimer">Bu görselde yapay zekâ ile oluşturulmuş dijital model kullanılmıştır.</p>
        </div>
        <article className="detailInfo">
          <h2 className="detailDesktopTitle">{product.name}</h2>
          <p>{product.description}</p>
          <strong className="detailPrice">{formatPrice(product.price)}</strong>
          <span className="catTag">{product.category_name}</span>
          {showColorPicker && (
            <div className="colorPanel">
              <span className="optionLabel">Renk secimi</span>
              <div className="colorRow">
              {colors.map((color) => (
                <button
                  key={color.id}
                  className={`colorChoice ${String(selectedColorId) === String(color.id) ? "active" : ""}`}
                  title={color.color_name}
                  aria-label={color.color_name}
                  onClick={() => {
                    setSelectedColorId(color.id);
                    setSelected(0);
                    emblaApi?.scrollTo(0);
                  }}
                >
                  <span className="colorSwatch" style={{ backgroundColor: colorHexOrFallback(color) }} />
                  {color.color_name}
                </button>
              ))}
              <button
                className={`colorPill ${selectedColorId === "all" ? "active" : ""}`}
                onClick={() => {
                  setSelectedColorId("all");
                  setSelected(0);
                  emblaApi?.scrollTo(0);
                }}
                title="Tum gorseller"
              >
                Tumu
              </button>
              </div>
            </div>
          )}
          {!showColorPicker && colors[0] && (
            <span className="colorLabel">{colors[0].color_name}</span>
          )}
          {showColorPicker && activeColor && (
            <span className="colorLabel">{activeColor.color_name}</span>
          )}
          <div className="sizes">
            {selectedColorId === "all" && showColorPicker && (
              <span className="sizeHint">Beden bilgisi icin renk seciniz</span>
            )}
            {visibleSizes.map((size) => (
              <span key={size.id} className={size.stock_quantity === 0 ? "off" : ""}>
                {size.size_label} - {statusText(size)}
              </span>
            ))}
          </div>
          <div className="contactCta">
            <span className="optionLabel">Siparis icin yazin</span>
            <div className="contactButtons">
              {listedPrice ? (
                <a className="cta whatsapp" href="https://wa.me/" target="_blank" rel="noreferrer">WhatsApp'tan Sor</a>
              ) : (
                <button className="cta whatsapp" type="button" disabled>WhatsApp'tan Sor</button>
              )}
              <a className="cta instagram" href="https://www.instagram.com/butikyazma/" target="_blank" rel="noreferrer"><InstagramIcon /> Instagram'dan Sor</a>
            </div>
          </div>
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
