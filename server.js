const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// ╔════════════════════════════════════════════════════════════╗
// ║  IMPORTANTE - RAILWAY                                  ║
// ║  1. Ve al dashboard → haz clic derecho en tu servicio  ║
// ║  2. "Volumes" → New Volume                             ║
// ║  3. Mount path:  /app/data                             ║
// ║     (o /data si prefieres, pero /app/data es estándar) ║
// ║  4. Redeploy después de crear el volumen               ║
// ╚════════════════════════════════════════════════════════════╝
const BASE_DIR = "/app/data/pastes";

// Inicialización fuerte + debug
(async () => {
  try {
    await fs.mkdir(BASE_DIR, { recursive: true });
    // Prueba real de escritura (muy útil en Railway)
    const testFile = path.join(BASE_DIR, ".write-test");
    await fs.writeFile(testFile, "test-ok");
    await fs.unlink(testFile);
    console.log(`✅ Volumen OK - carpeta escribible: ${BASE_DIR}`);
  } catch (err) {
    console.error("❌ ERROR CRÍTICO: No se puede escribir en el volumen!");
    console.error("Posibles causas:");
    console.error("  • No creaste un Volume en Railway");
    console.error("  • Mount path incorrecto (debe ser /app/data o el que elegiste)");
    console.error("  • Permisos (raro, pero prueba RAILWAY_RUN_UID=0 en variables)");
    console.error(err);
    // NO matamos el proceso para que al menos sirva la página de error
  }
})();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Token único por usuario (ya estaba bien)
app.use(async (req, res, next) => {
  if (!req.cookies.user_token) {
    const token = crypto.randomUUID().replace(/-/g, "");
    res.cookie("user_token", token, {
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 año
      httpOnly: true,
      sameSite: "lax"
    });
    req.user_token = token;
  } else {
    req.user_token = req.cookies.user_token;
  }
  next();
});

async function getUserPastes(token) {
  try {
    const files = await fs.readdir(BASE_DIR);
    return files
      .filter(f => f.startsWith(token + "_") && f.endsWith(".txt"))
      .map(f => f.replace(token + "_", "").replace(".txt", ""));
  } catch {
    return [];
  }
}

// Página principal
app.get("/", async (req, res) => {
  const pastes = await getUserPastes(req.user_token);

  res.send(`
  <html>
  <head>
    <title>Pastefy — bxl VM</title>
    <style>
      body { background:#0d0d0d; color:#eaeaea; font-family:Arial; margin:0; }
      header { background:#111; padding:1.2rem; font-size:1.6rem; color:#00e676; border-bottom:3px solid #00e676; text-align:center; }
      .container { max-width:920px; margin:2rem auto; padding:0 1rem; }
      textarea, input {
        width:100%; background:#1a1a1a; color:#00e676; border:1px solid #444;
        padding:1rem; border-radius:8px; font-family:monospace; margin-bottom:1rem;
        box-sizing:border-box;
      }
      button {
        padding:0.9rem 2rem; background:#00e676; color:#000; border:none;
        border-radius:8px; font-size:1.1rem; cursor:pointer; font-weight:bold;
      }
      button:hover { background:#00c853; }
      .list { margin-top:2.5rem; background:#111; padding:1.5rem; border-radius:10px; }
      .list a { color:#00e676; text-decoration:none; display:block; padding:0.5rem 0; font-size:1.1rem; }
      .list a:hover { text-decoration:underline; }
      .error { color:#ff5252; background:#330000; padding:1rem; border-radius:8px; margin:1rem 0; }
    </style>
  </head>
  <body>
    <header>Pastefy — bxl VM</header>
    <div class="container">
      <h2>Crear nuevo paste</h2>
      <form method="POST" action="/paste">
        <input name="name" placeholder="Nombre del paste (opcional, solo letras,números,-,_)" maxlength="50">
        <textarea name="text" rows="10" placeholder="Pega tu script aquí..."></textarea>
        <button type="submit">Crear Paste</button>
      </form>

      <div class="list">
        <h3>Tus pastes</h3>
        ${pastes.length === 0 
          ? "<p>No hay pastes aún. ¡Crea uno!</p>" 
          : pastes.map(id => `<a href="/edit/\( {id}"> \){id}</a>`).join("")}
      </div>
    </div>
  </body>
  </html>
  `);
});

// Crear paste
app.post("/paste", async (req, res) => {
  let { text, name } = req.body;
  text = (text || "").trim();

  if (!text) {
    return res.send('<h2 style="color:#ff5252">Nada que pegar...</h2><a href="/">Volver</a>');
  }

  if (!name || name.trim() === "") {
    const pastes = await getUserPastes(req.user_token);
    const count = pastes.filter(p => p.startsWith("None-")).length + 1;
    name = `None-${count}`;
  }

  // Sanitize muy estricto
  name = name.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "unnamed";

  const filePath = path.join(BASE_DIR, `\( {req.user_token}_ \){name}.txt`);

  try {
    await fs.writeFile(filePath, text, "utf8");
    const rawUrl = `\( {req.protocol}:// \){req.get("host")}/raw/${name}`;

    res.send(`
      <h1 style="color:#00e676">Paste creado exitosamente</h1>
      <p>Enlace RAW (para loadstring):</p>
      <pre style="background:#111;color:#00e676;padding:1rem;border-radius:8px;">${rawUrl}</pre>
      <pre style="background:#111;color:#fff;padding:1rem;border-radius:8px;">loadstring(game:HttpGet("${rawUrl}"))()</pre>
      <br>
      <a href="/">Volver al inicio</a> | <a href="/edit/${name}">Editar</a>
    `);
  } catch (err) {
    console.error("Error al guardar paste:", err);
    res.send('<h2 style="color:#ff5252">Error al guardar el paste (problema de disco?)</h2><pre>' + err.message + '</pre><a href="/">Volver</a>');
  }
});

// Editar
app.get("/edit/:id", async (req, res) => {
  const id = req.params.id;
  const filePath = path.join(BASE_DIR, `\( {req.user_token}_ \){id}.txt`);

  try {
    const content = await fs.readFile(filePath, "utf8");
    res.send(`
      <h1>Editando: ${id}</h1>
      <form method="POST" action="/edit/${id}">
        <textarea name="text" rows="20" style="width:100%; font-family:monospace;">${content.replace(/</g, "&lt;")}</textarea>
        <br><br>
        <button type="submit">Guardar cambios</button>
      </form>
      <br><a href="/">Volver</a>
    `);
  } catch {
    res.send('<h2 style="color:#ff5252">No tienes permiso o el paste no existe.</h2><a href="/">Volver</a>');
  }
});

app.post("/edit/:id", async (req, res) => {
  const filePath = path.join(BASE_DIR, `\( {req.user_token}_ \){req.params.id}.txt`);
  try {
    await fs.writeFile(filePath, req.body.text || "", "utf8");
    res.send('Guardado correctamente. <a href="/edit/' + req.params.id + '">Volver a editar</a> | <a href="/">Inicio</a>');
  } catch (err) {
    res.send('Error al guardar: ' + err.message);
  }
});

// RAW (estilo Luarmor)
app.get("/raw/:id", async (req, res) => {
  const filePath = path.join(BASE_DIR, `\( {req.user_token}_ \){req.params.id}.txt`);

  try {
    const content = await fs.readFile(filePath, "utf8");
    const accept = (req.get("Accept") || "").toLowerCase();
    const ua = (req.get("User-Agent") || "").toLowerCase();

    const isBrowser = accept.includes("text/html");
    const isRobloxLike = ua.includes("roblox") || ua.includes("wininet");

    if (isRobloxLike) {
      res.set("Content-Type", "text/plain");
      return res.send(content);
    }

    if (isBrowser) {
      const fullRawUrl = `\( {req.protocol}:// \){req.get("host")}/raw/${req.params.id}`;
      return res.send(`
        <html>
        <head><title>Loadstring - bxl VM</title>
        <style>
          body{background:#0a0a0a;color:#eee;font-family:Arial;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}
          .box{background:#111;padding:2rem;border-radius:12px;width:90%;max-width:580px;border:1px solid #222;}
          pre{background:#000;padding:1.2rem;border-radius:8px;color:#00e676;overflow-x:auto;font-size:1.05rem;}
          .note{color:#888;text-align:center;margin-top:1.5rem;}
        </style>
        </head>
        <body>
          <div class="box">
            <h2>📜 Loadstring listo</h2>
            <pre>loadstring(game:HttpGet("${fullRawUrl}"))()</pre>
            <div class="note">Contenido no visible en navegador • bxl VM</div>
          </div>
        </body>
        </html>
      `);
    }

    res.set("Content-Type", "text/plain");
    res.send(content);
  } catch {
    res.status(404).send("Paste no encontrado o no tienes acceso.");
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} (Railway asigna el puerto via $PORT)`);
});
