const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();

const PORT = process.env.PORT || 3000;
const PASTES_DIR = path.join(__dirname, 'pastes');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Obtener lista de pastes
async function getAllPastes() {
  try {
    const files = await fs.readdir(PASTES_DIR);
    return files.filter(f => f.endsWith('.txt')).map(f => f.replace('.txt', ''));
  } catch {
    return [];
  }
}

// Página principal estilo Pastefy
app.get('/', async (req, res) => {
  const pastes = await getAllPastes();

  res.send(`
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Pastefy — bxl VM</title>
    <style>
      body { margin:0; background:#0d0d0d; color:#eaeaea; font-family:Arial; }
      header { background:#111; padding:1rem 2rem; font-size:1.5rem; font-weight:bold; color:#00e676; border-bottom:2px solid #00e676; }
      .container { max-width:900px; margin:2rem auto; padding:1rem; }
      textarea { width:100%; height:300px; background:#1a1a1a; color:#00e676; border:1px solid #333; padding:1rem; font-family:monospace; border-radius:6px; }
      button { margin-top:1rem; padding:0.8rem 1.5rem; background:#00e676; color:#000; border:none; border-radius:6px; font-size:1rem; cursor:pointer; font-weight:bold; }
      button:hover { background:#00c853; }
      .list { margin-top:2rem; background:#111; padding:1rem; border-radius:6px; }
      .list a { color:#00e676; text-decoration:none; display:block; padding:0.3rem 0; }
      .list a:hover { color:#00c853; }
    </style>
  </head>
  <body>
    <header>Pastefy — Protected by bxl VM</header>
    <div class="container">
      <h2>Crear nuevo paste</h2>
      <form method="POST" action="/paste">
        <textarea name="text" placeholder="Pega tu script aquí..."></textarea>
        <button type="submit">Crear Paste</button>
      </form>

      <div class="list">
        <h3>Tus pastes guardados</h3>
        ${pastes.length === 0 ? "<p>No hay pastes aún.</p>" : pastes.map(id => `
          <a href="/raw/${id}">${id}</a>
        `).join('')}
      </div>
    </div>
  </body>
  </html>
  `);
});

// Crear paste
app.post('/paste', async (req, res) => {
  const text = req.body.text || '';
  if (!text.trim()) return res.send("Nada que pegar.");

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const filePath = path.join(PASTES_DIR, `${id}.txt`);

  await fs.mkdir(PASTES_DIR, { recursive: true });
  await fs.writeFile(filePath, text, 'utf8');

  const rawUrl = `${req.protocol}://${req.get('host')}/raw/${id}`;

  res.send(`
    <h1>Paste creado</h1>
    <p><a href="${rawUrl}">${rawUrl}</a></p>
    <p>Para Delta:</p>
    <pre>loadstring(game:HttpGet("${rawUrl}"))()</pre>
  `);
});

// RAW estilo Luarmor
app.get('/raw/:id', async (req, res) => {
  const filePath = path.join(PASTES_DIR, `${req.params.id}.txt`);

  try {
    const content = await fs.readFile(filePath, 'utf8');

    const accept = (req.get("Accept") || "").toLowerCase();
    const ua = (req.get("User-Agent") || "").toLowerCase();

    const isBrowser = accept.includes("text/html");

    const isDelta =
      ua.includes("roblox") ||
      ua.includes("wininet");

    const isCopyAttempt =
      accept === "*/*" && !isDelta;

    if (isCopyAttempt) {
      res.set("Content-Type", "text/plain");
      return res.send("⚠️ Script protegido por bxl VM");
    }

    if (isDelta) {
      res.set("Content-Type", "text/plain");
      return res.send(content);
    }

    if (isBrowser) {
      return res.send(`
        <html>
        <body style="background:#000; color:#00e676; font-size:2rem; display:flex; justify-content:center; align-items:center; height:100vh; font-family:Arial;">
          <div style="text-align:center;">
            <div style="font-size:3rem; margin-bottom:1rem;">bxl VM</div>
            <div>Este script está protegido</div>
          </div>
        </body>
        </html>
      `);
    }

    res.set("Content-Type", "text/plain");
    res.send(content);

  } catch {
    res.status(404).send("Paste no encontrado");
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
