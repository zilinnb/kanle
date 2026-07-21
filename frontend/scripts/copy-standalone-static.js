// postbuild: 将 .next/static 和 public 复制到 standalone 目录
// Next.js standalone 模式不自动复制静态文件，需要手动同步
const fs = require("fs");
const path = require("path");

const standaloneDir = path.join(".next", "standalone");
if (!fs.existsSync(standaloneDir)) {
  console.log("[postbuild] standalone dir not found, skipping copy");
  process.exit(0);
}

// .next/static -> standalone/.next/static
const staticSrc = path.join(".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");
if (fs.existsSync(staticSrc)) {
  fs.cpSync(staticSrc, staticDest, { recursive: true });
  console.log("[postbuild] copied .next/static -> standalone/.next/static");
}

// public -> standalone/public
if (fs.existsSync("public")) {
  fs.cpSync("public", path.join(standaloneDir, "public"), { recursive: true });
  console.log("[postbuild] copied public -> standalone/public");
}
