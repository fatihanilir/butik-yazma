import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) return res.status(401).json({ message: "Yetkisiz erişim." });

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: "Oturum geçersiz veya süresi doldu." });
  }
}
