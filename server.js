const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Railway solo permite escribir en /tmp
const BASE_DIR = "/tmp/pastes";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Crear token único por usuario
app.use(async (req, res, next) => {
  if (!req.cookies.user_token) {
    const token = crypto.randomUUID().replace(/-/g, "");
    res.cookie("user_token", token, { maxAge: 1000 * 60 * 60 * 24 * 365 });
    req.user_token = token;
  } else {
    req.user_token = req.cookies.user_token;
  }

  await fs.mkdir(BASE_DIR, { recursive: true });
  next();
});

// Obtener pastes del usuario
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
      body { background:#0d0d0d; color:#eaeaea; font-family:Arial; }
      header { background:#111; padding:1rem; font-size:1.5rem; color:#00e676; border-bottom:2px solid #00e676; }
      .container { max-width:900px; margin:2rem auto; }
      textarea { width:100%; height:300px; background:#1a1a1a; color:#00e676; border:1px solid #333; padding:1rem; font-family:monospace; border-radius:6px; }
      input { width:100%; padding:0.5rem; margin-bottom:1rem; border-radius:6px; border:none; background:#1a1a1a; color:#00e676; }
      button { padding:0.8rem 1.5rem; background:#00e676; color:#000; border:none; border-radius:6px; font-size:1rem; cursor:pointer; font-weight:bold; }
      .list { margin-top:2rem; background:#111; padding:1rem; border-radius:6px; }
      .list a { color:#00e676; text-decoration:none; display:block; padding:0.3rem 0; }
    </style>
  </head>
  <body>
    <header>Pastefy — bxl VM</header>
    <div class="container">
      <h2>Crear nuevo paste</h2>
      <form method="POST" action="/paste">
        <input name="name" placeholder="Nombre del paste...">
        <textarea name="text" placeholder="Pega tu script aquí..."></textarea>
        <button type="submit">Crear Paste</button>
      </form>

      <div class="list">
        <h3>Tus pastes</h3>
        ${pastes.length === 0 ? "<p>No hay pastes aún.</p>" : pastes.map(id => `
          <a href="/edit/${id}">${id}</a>
        `).join("")}
      </div>
    </div>
  </body>
  </html>
  `);
});

// Crear paste
app.post("/paste", async (req, res) => {
  const text = req.body.text || "";
  const name = req.body.name?.trim() || "sin_nombre";

  if (!text.trim()) return res.send("Nada que pegar.");

  const id = name.replace(/[^a-zA-Z0-9_-]/g, "") || "paste";
  const filePath = path.join(BASE_DIR, `${req.user_token}_${id}.txt`);

  await fs.writeFile(filePath, text, "utf8");

  const rawUrl = `${req.protocol}://${req.get("host")}/raw/${id}`;

  res.send(`
    <h1>Paste creado</h1>
    <p><a href="${rawUrl}">${rawUrl}</a></p>
    <pre>loadstring(game:HttpGet("${rawUrl}"))()</pre>
  `);
});

// Editar paste
app.get("/edit/:id", async (req, res) => {
  const filePath = path.join(BASE_DIR, `${req.user_token}_${req.params.id}.txt`);

  try {
    const content = await fs.readFile(filePath, "utf8");

    res.send(`
      <h1>Editando: ${req.params.id}</h1>
      <form method="POST" action="/edit/${req.params.id}">
        <textarea name="text" style="width:100%;height:300px;">${content}</textarea>
        <button type="submit">Guardar</button>
      </form>
    `);

  } catch {
    res.send("No tienes permiso para ver este paste.");
  }
});

// Guardar edición
app.post("/edit/:id", async (req, res) => {
  const filePath = path.join(BASE_DIR, `${req.user_token}_${req.params.id}.txt`);
  await fs.writeFile(filePath, req.body.text, "utf8");
  res.send("Guardado.");
});

// RAW estilo Luarmor
app.get("/raw/:id", async (req, res) => {
  const filePath = path.join(BASE_DIR, `${req.user_token}_${req.params.id}.txt`);

  try {
    const content = await fs.readFile(filePath, "utf8");
    res.set("Content-Type", "text/plain");
    return res.send(content);
  } catch {
    return res.status(404).send("No encontrado.");
  }
});

app.listen(PORT, () => {
  console.log("Servidor corriendo en Railway en puerto " + PORT);
});
    res.send(`
      <h1>Editando: ${req.params.id}</h1>
      <form method="POST" action="/edit/${req.params.id}">
        <textarea name="text" style="width:100%;height:300px;">${content}</textarea>
        <button type="submit">Guardar</button>
      </form>
    `);

  } catch {
    res.send("No tienes permiso para ver este paste.");
  }
});

// Guardar edición
app.post('/edit/:id', async (req, res) => {
  const filePath = path.join(PASTES_DIR, `${req.user_token}_${req.params.id}.txt`);
  await fs.writeFile(filePath, req.body.text, 'utf8');
  res.send("Guardado.");
});

// RAW estilo Luarmor
app.get('/raw/:id', async (req, res) => {
  const filePath = path.join(PASTES_DIR, `${req.user_token}_${req.params.id}.txt`);

  try {
    const content = await fs.readFile(filePath, 'utf8');

    res.set("Content-Type", "text/plain");
    return res.send(content);

  } catch {
    return res.status(404).send("No encontrado.");
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
