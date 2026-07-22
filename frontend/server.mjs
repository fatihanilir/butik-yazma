import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "dist");
const port = Number(process.env.PORT) || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function responseHeaders(filePath) {
  const relative = path.relative(dist, filePath).replace(/\\/g, "/");
  if (relative.startsWith("assets/")) {
    return { "Cache-Control": "public, max-age=31536000, immutable" };
  }
  if (relative.endsWith(".html") || relative === "index.html") {
    return { "Cache-Control": "no-cache, must-revalidate" };
  }
  return { "Cache-Control": "public, max-age=86400" };
}

function sendFile(res, filePath, statusCode = 200) {
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(statusCode, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      ...responseHeaders(filePath),
    });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = path.join(dist, urlPath === "/" ? "index.html" : urlPath);

    if (!filePath.startsWith(dist)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        sendFile(res, path.join(dist, "index.html"));
        return;
      }
      sendFile(res, filePath);
    });
  })
  .listen(port, "0.0.0.0", () => {
    console.log(`Frontend ready on port ${port}`);
  });
