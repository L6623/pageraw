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
      textarea, input {
        width:100%; background:#1a1a1a; color:#00e676;
        border:1px solid #333; padding:1rem; border-radius:6px;
        font-family:monospace; margin-bottom:1rem;
      }
      button {
        padding:0.8rem 1.5rem; background:#00e676; color:#000;
        border:none; border-radius:6px; font-size:1rem; cursor:pointer;
      }
      .list { margin-top:2rem; background:#111; padding:1rem; border-radius:6px; }
      .list a { color:#00e676; text-decoration:none; display:block; padding:0.3rem 0; }
    </style>
  </head>
  <body>
    <header>Pastefy — bxl VM</header>
    <div class="container">
      <h2>Crear nuevo paste</h2>
      <form method="POST" action="/paste">
        <input name="name" placeholder="Nombre del paste (opcional)">
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
  let name = req.body.name?.trim();

  if (!text.trim()) return res.send("Nada que pegar.");

  // Si no pone nombre → None-1, None-2, etc.
  if (!name) {
    const pastes = await getUserPastes(req.user_token);
    const count = pastes.filter(p => p.startsWith("None")).length + 1;
    name = `None-${count}`;
  }

  name = name.replace(/[^a-zA-Z0-9_-]/g, "") || "None";

  const filePath = path.join(BASE_DIR, `${req.user_token}_${name}.txt`);
  await fs.writeFile(filePath, text, "utf8");

  const rawUrl = `${req.protocol}://${req.get("host")}/raw/${name}`;

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

    const accept = (req.get("Accept") || "").toLowerCase();
    const ua = (req.get("User-Agent") || "").toLowerCase();

    const isBrowser = accept.includes("text/html");
    const isDelta = ua.includes("roblox") || ua.includes("wininet");

    if (isDelta) {
      res.set("Content-Type", "text/plain");
      return res.send(content);
    }

    if (isBrowser) {
      return res.send(`
        <html>
        <head>
          <title>Loadstring — bxl VM</title>
          <style>
            body {
              background:#0a0a0a;
              color:white;
              font-family:Arial;
              display:flex;
              justify-content:center;
              align-items:center;
              height:100vh;
              margin:0;
            }
            .box {
              background:#111;
              padding:20px;
              border-radius:10px;
              width:90%;
              max-width:500px;
              border:1px solid #222;
            }
            .title {
              font-size:1.5rem;
              margin-bottom:10px;
            }
            pre {
              background:#0d0d0d;
              padding:10px;
              border-radius:6px;
              color:#00e676;
              overflow-x:auto;
            }
            .note {
              margin-top:10px;
              color:#888;
              font-size:0.9rem;
              text-align:center;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="title">📜 Loadstring</div>
            <pre>
script_key = "KEY";
loadstring(game:HttpGet("${req.protocol}://${req.get('host')}/raw/${req.params.id}"))()
            </pre>
            <div class="note">Contents can not be displayed on browser • bxl VM</div>
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
  console.log("Servidor corriendo en Railway en puerto " + PORT);
});
