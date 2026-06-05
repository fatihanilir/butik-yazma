import fs from "fs";
import path from "path";
import multer from "multer";
import { config } from "../config.js";

fs.mkdirSync(config.uploadDir, { recursive: true });

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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseRaw = path.basename(file.originalname, ext);
    const base = sanitizeFilename(baseRaw) || "image";
    const suffix = Math.random().toString(36).slice(2, 8);
    cb(null, `${Date.now()}-${suffix}-${base}${ext}`);
  },
});

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) return cb(new Error("Sadece JPEG, PNG, WebP desteklenir."));
    return cb(null, true);
  },
});
