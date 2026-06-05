import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveUploadDir(raw) {
  const value = raw || "uploads";
  if (path.isAbsolute(value)) return value;
  if (value.startsWith("backend/") || value.startsWith("backend\\")) {
    return path.resolve(backendRoot, "..", value);
  }
  return path.resolve(backendRoot, value);
}

export const config = {
  port: Number(process.env.PORT || 4000),
  dbUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  uploadDir: resolveUploadDir(process.env.UPLOAD_DIR),
  adminUsername: process.env.ADMIN_USERNAME || "ArdaG",
  adminPassword: process.env.ADMIN_PASSWORD || "fitcheck",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
};

fs.mkdirSync(config.uploadDir, { recursive: true });
