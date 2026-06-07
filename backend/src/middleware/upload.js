import path from "path";
import multer from "multer";

function sanitizeFilename(filename) {
  const trMap = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "c",
    Ğ: "g",
    İ: "i",
    I: "i",
    Ö: "o",
    Ş: "s",
    Ü: "u",
  };
  const replaced = [...filename].map((char) => trMap[char] ?? char).join("");
  return replaced
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function createUploadFilename(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  const baseRaw = path.basename(originalname, ext);
  const base = sanitizeFilename(baseRaw) || "image";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${suffix}-${base}${ext}`;
}

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) return cb(new Error("Sadece JPEG, PNG, WebP desteklenir."));
    return cb(null, true);
  },
});
