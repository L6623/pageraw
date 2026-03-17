const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser'); // Necesitas instalar esto: npm install cookie-parser

const app = express();

const PORT = process.env.PORT || 3000;
const PASTES_DIR = path.join(__dirname, 'pastes');
const PASSWORD_SISTEMA = "66ms"; // Tu contraseña

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// --- MIDDLEWARE DE AUTENTICACIÓN ---
const authMiddleware = (req, res, next) => {
  // Permitir acceso a la ruta de login sin estar autenticado
  if (req.path === '/login') return next();
  
  // Si tiene la cookie correcta, adelante
  if (req.cookies.auth_token === 'authenticated_user') {
    return next();
  }
  
  // Si no, redirigir al login
  res.redirect('/login');
};

// Aplicar el middleware a todas las rutas EXCEPTO a los archivos RAW (para que Delta funcione)
app.use((req, res, next) => {
    if (req.path.startsWith('/raw/')) return next();
    authMiddleware(req, res, next);
});

// --- RUTAS DE LOGIN ---
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Login — bxl VM</title>
      <style>
        body { background:#0d0d0d; color:#00e676; font-family:Arial; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; }
        .login-box { background:#111; padding:2rem; border-radius:10px; border:1px solid #00e676; text-align:center; }
        input { background:#1a1a1a; border:1px solid #333; color:#fff; padding:10px; border-radius:5px; margin-bottom:10px; width:200px; }
        button { background:#00e676; color:#000; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold; }
      </style>
    </head>
    <body>
      <div class="login-box">
        <h2>🔒 Acceso Restringido</h2>
        <form method="POST" action="/login">
          <input type="password" name="password" placeholder="Contraseña..." required><br>
          <button type="submit">Entrar</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  if (req.body.password === PASSWORD_SISTEMA) {
    // Guardar cookie por 24 horas
    res.cookie('auth_token', 'authenticated_user', { maxAge: 86400000, httpOnly: true });
    res.redirect('/');
  } else {
    res.send("<script>alert('Contraseña incorrecta'); window.location='/login';</script>");
  }
});

// --- TUS RUTAS ORIGINALES (MODIFICADAS) ---

// Obtener lista de pastes
async function getAllPastes() {
  try {
    const files = await fs.readdir(PASTES_DIR);
    return files.filter(f => f.endsWith('.txt')).map(f => f.replace('.txt', ''));
  } catch {
    return [];
  }
}

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
        ${pastes.length === 0 ? "<p>No hay pastes aún.</p>" : pastes.map(id => `<a href="/raw/${id}">${id}</a>`).join('')}
      </div>
    </div>
  </body>
  </html>
  `);
});

app.post('/paste', async (req, res) => {
  const text = req.body.text || '';
  if (!text.trim()) return res.send("Nada que pegar.");
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const filePath = path.join(PASTES_DIR, `${id}.txt`);
  await fs.mkdir(PASTES_DIR, { recursive: true });
  await fs.writeFile(filePath, text, 'utf8');
  const rawUrl = `${req.protocol}://${req.get('host')}/raw/${id}`;
  res.send(`<h1>Paste creado</h1><p><a href="${rawUrl}">${rawUrl}</a></p><p>Para Delta:</p><pre>loadstring(game:HttpGet("${rawUrl}"))()</pre><br><a href="/">Volver</a>`);
});

app.get('/raw/:id', async (req, res) => {
  const filePath = path.join(PASTES_DIR, `${req.params.id}.txt`);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const ua = (req.get("User-Agent") || "").toLowerCase();
    const accept = (req.get("Accept") || "").toLowerCase();
    
    const isDelta = ua.includes("roblox") || ua.includes("wininet");
    const isBrowser = accept.includes("text/html");

    // Si es Delta o Executor, entregamos el código directo
    if (isDelta) {
      res.set("Content-Type", "text/plain");
      return res.send(content);
    }

    // Si es navegador, mostramos la pantalla de "Script Protegido"
    if (isBrowser) {
        return res.send(`
        <html>
        <head><title>Loadstring — bxl VM</title><style>body{background:#000;color:white;font-family:Arial;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}.box{background:#0d0d0d;padding:20px;border-radius:10px;width:90%;max-width:500px;border:1px solid #222;}.title{font-size:1.5rem;margin-bottom:10px;}pre{background:#111;padding:10px;border-radius:6px;color:#00e676;overflow-x:auto;}.note{margin-top:10px;color:#888;font-size:0.9rem;text-align:center;}</style></head>
        <body>
          <div class="box">
            <div class="title">📜 Loadstring</div>
            <pre>loadstring(game:HttpGet("${req.protocol}://${req.get('host')}/raw/${req.params.id}"))()</pre>
            <div class="note">Contents can not be displayed on browser • bxl VM</div>
          </div>
        </body>
        </html>`);
    }

    res.set("Content-Type", "text/plain");
    res.send("⚠️ Acceso denegado.");
  } catch {
    res.status(404).send("Paste no encontrado");
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

