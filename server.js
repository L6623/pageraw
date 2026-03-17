const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();

// Configuración de Railway o Local
const PORT = process.env.PORT || 3000;
const PASTES_DIR = path.join(__dirname, 'pastes');
const PASSWORD_SISTEMA = "66ms"; 

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- LÓGICA DE PROTECCIÓN ---
const checkAuth = (req, res, next) => {
  // 1. Si vas a ver un script RAW, te dejamos pasar (para que cargue en el juego)
  if (req.path.startsWith('/raw/')) return next();
  
  // 2. Si vas a loguearte, te dejamos pasar
  if (req.path === '/login') return next();

  // 3. Si tienes la cookie, pasas. Si no, al login.
  if (req.cookies.access_key === PASSWORD_SISTEMA) {
    return next();
  } else {
    res.redirect('/login');
  }
};

// --- RUTAS ---

app.get('/login', (req, res) => {
  res.send(`
    <html>
    <head><title>Login — bxl VM</title><style>
      body { background:#0d0d0d; color:#00e676; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; }
      .box { background:#111; padding:30px; border-radius:10px; border:1px solid #00e676; text-align:center; box-shadow: 0 0 20px rgba(0,230,118,0.2); }
      input { background:#1a1a1a; border:1px solid #333; color:#fff; padding:12px; border-radius:5px; margin-bottom:15px; width:220px; outline:none; }
      button { background:#00e676; color:#000; border:none; padding:12px 25px; border-radius:5px; cursor:pointer; font-weight:bold; width:100%; }
    </style></head>
    <body>
      <div class="box">
        <h2>🔒 bxl VM Login</h2>
        <form method="POST" action="/login">
          <input type="password" name="pass" placeholder="Contraseña..." required autofocus><br>
          <button type="submit">ACCEDER</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  if (req.body.pass === PASSWORD_SISTEMA) {
    res.cookie('access_key', PASSWORD_SISTEMA, { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true });
    res.redirect('/');
  } else {
    res.send("<script>alert('Clave incorrecta'); window.location='/login';</script>");
  }
});

// Aplicar protección a las rutas de abajo
app.use(checkAuth);

app.get('/', async (req, res) => {
  let pastes = [];
  try {
    const files = await fs.readdir(PASTES_DIR);
    pastes = files.filter(f => f.endsWith('.txt')).map(f => f.replace('.txt', ''));
  } catch (e) {}

  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"><title>Pastefy — bxl VM</title>
    <style>
      body { margin:0; background:#0d0d0d; color:#eaeaea; font-family:Arial; }
      header { background:#111; padding:1rem 2rem; font-size:1.5rem; font-weight:bold; color:#00e676; border-bottom:2px solid #00e676; display:flex; justify-content:space-between; }
      .container { max-width:900px; margin:2rem auto; padding:1rem; }
      textarea { width:100%; height:250px; background:#1a1a1a; color:#00e676; border:1px solid #333; padding:1rem; font-family:monospace; border-radius:6px; outline:none; }
      button { margin-top:1rem; padding:0.8rem 1.5rem; background:#00e676; color:#000; border:none; border-radius:6px; font-size:1rem; cursor:pointer; font-weight:bold; }
      .list { margin-top:2rem; background:#111; padding:1rem; border-radius:6px; border:1px solid #222; }
      .list a { color:#00e676; text-decoration:none; display:block; padding:8px; border-bottom:1px solid #1a1a1a; }
      .logout { font-size: 0.8rem; color: #ff4444; text-decoration: none; border: 1px solid #ff4444; padding: 5px 10px; border-radius: 5px; }
    </style>
  </head>
  <body>
    <header>
        <span>Pastefy — bxl VM</span>
        <a href="/logout" class="logout">Cerrar Sesión</a>
    </header>
    <div class="container">
      <h2>Nuevo Paste</h2>
      <form method="POST" action="/paste">
        <textarea name="text" placeholder="Pega tu script aquí..." required></textarea>
        <button type="submit">Crear Script</button>
      </form>
      <div class="list">
        <h3>Scripts Guardados</h3>
        ${pastes.length === 0 ? "<p>No hay scripts.</p>" : pastes.reverse().map(id => `<a href="/raw/${id}" target="_blank">📄 ${id}</a>`).join('')}
      </div>
    </div>
  </body>
  </html>
  `);
});

app.get('/logout', (req, res) => {
    res.clearCookie('access_key');
    res.redirect('/login');
});

app.post('/paste', async (req, res) => {
  const text = req.body.text || '';
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const filePath = path.join(PASTES_DIR, `${id}.txt`);
  await fs.mkdir(PASTES_DIR, { recursive: true });
  await fs.writeFile(filePath, text, 'utf8');
  res.redirect('/');
});

app.get('/raw/:id', async (req, res) => {
  const filePath = path.join(PASTES_DIR, `${req.params.id}.txt`);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const ua = (req.get("User-Agent") || "").toLowerCase();
    const isDelta = ua.includes("roblox") || ua.includes("wininet") || ua.includes("delta");

    if (isDelta) {
      res.set("Content-Type", "text/plain");
      return res.send(content);
    }

    res.send(`
      <html><body style="background:#000;color:#00e676;font-family:monospace;padding:50px;">
      <h2>📜 Loadstring Protegido</h2>
      <pre style="background:#111;padding:20px;border:1px dashed #00e676;">loadstring(game:HttpGet("${req.protocol}://${req.get('host')}/raw/${req.params.id}"))()</pre>
      <p style="color:#666;">Contenido oculto en navegador por bxl VM</p>
      </body></html>
    `);
  } catch { res.status(404).send("No encontrado"); }
});

app.listen(PORT, () => console.log(`Online en puerto ${PORT}`));

