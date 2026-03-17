const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();

const PORT = process.env.PORT || 3000;
const PASTES_DIR = path.join(__dirname, 'pastes');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Página principal (formulario)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Paste Raw - Protected by bxl VM</title>
      <style>
        body { 
          font-family: monospace; 
          background: #111; 
          color: #eee; 
          padding: 2rem; 
          margin: 0; 
        }
        h1 { color: #0f0; }
        textarea { 
          width: 100%; 
          height: 350px; 
          background: #222; 
          color: #0f0; 
          border: 1px solid #444; 
          padding: 1rem; 
          font-size: 1rem; 
          font-family: monospace;
        }
        button { 
          padding: 1rem 2rem; 
          background: #0f0; 
          color: #000; 
          border: none; 
          cursor: pointer; 
          font-size: 1.2rem; 
          margin-top: 1rem;
        }
        button:hover { background: #0c0; }
        p { margin: 1rem 0; color: #aaa; }
      </style>
    </head>
    <body>
      <h1>Pega tu script o texto</h1>
      <p>Después crea el paste y usa el link <strong>/view/ID</strong> para la versión protegida (capa negra total).</p>
      <form method="POST" action="/paste">
        <textarea name="text" placeholder="Aquí va tu código..."></textarea><br>
        <button type="submit">Crear Paste</button>
      </form>
    </body>
    </html>
  `);
});

// Crear paste
app.post('/paste', async (req, res) => {
  const text = req.body.text || '';
  if (!text.trim()) {
    return res.status(400).send('<h1 style="color:#eee;background:#111;padding:2rem;">Nada que pegar :( <a href="/" style="color:#0f0;">Volver</a></h1>');
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const filePath = path.join(PASTES_DIR, `${id}.txt`);

  try {
    await fs.mkdir(PASTES_DIR, { recursive: true });
    await fs.writeFile(filePath, text, 'utf8');

    const rawUrl = `${req.protocol}://${req.get('host')}/raw/${id}`;
    const viewUrl = `${req.protocol}://${req.get('host')}/view/${id}`;

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="utf-8"><title>¡Listo!</title></head>
      <body style="font-family:monospace;background:#111;color:#eee;padding:2rem;">
        <h1>¡Paste creado!</h1>
        <p>Raw (texto plano): <a href="${rawUrl}" style="color:#0f0;">${rawUrl}</a></p>
        <p>Protegido (capa negra): <a href="${viewUrl}" style="color:#ff0044;">${viewUrl}</a></p>
        <p>curl ${rawUrl} para verlo en terminal</p>
        <h3>Preview:</h3>
        <pre style="background:#000;color:#0f0;padding:1rem;max-height:300px;overflow:auto;border:1px solid #333;">${text.slice(0, 500)}${text.length > 500 ? '...' : ''}</pre>
        <a href="/" style="color:#0f0;">Crear otro</a>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('<h1 style="color:#eee;background:#111;padding:2rem;">Error al guardar <a href="/" style="color:#0f0;">Volver</a></h1>');
  }
});

// Raw puro
app.get('/raw/:id', async (req, res) => {
  const filePath = path.join(PASTES_DIR, `${req.params.id}.txt`);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (err) {
    res.status(404).set('Content-Type', 'text/plain').send('Paste no encontrado :(\n');
  }
});

// View con capa negra 100% opaca (el texto queda invisible visualmente)
app.get('/view/:id', async (req, res) => {
  const filePath = path.join(PASTES_DIR, `${req.params.id}.txt`);
  try {
    const content = await fs.readFile(filePath, 'utf8');

    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Protected by bxl VM</title>
  <style>
    html, body { margin:0; padding:0; height:100vh; width:100vw; overflow:hidden; background:#000; }
    .content { position:absolute; inset:0; padding:2rem; color:#eee; white-space:pre-wrap; overflow:auto; background:#111; font-family:monospace; font-size:1rem; line-height:1.5; }
    .blocker { position:fixed; inset:0; background:#000; z-index:999999; display:flex; align-items:center; justify-content:center; pointer-events:all; user-select:none; -webkit-user-select:none; -moz-user-select:none; }
    .msg { color:#ff0044; font-size:3.5rem; font-weight:bold; text-align:center; padding:2rem 3rem; border:6px solid #ff0044; border-radius:20px; background:rgba(0,0,0,0.92); max-width:90%; box-shadow:0 0 40px rgba(255,0,68,0.6); }
  </style>
</head>
<body>
  <div class="content">${escaped}</div>
  <div class="blocker">
    <div class="msg">This script is protected by bxl VM</div>
  </div>
</body>
</html>`);
  } catch (err) {
    res.status(404).send('Paste no encontrado');
  }
});

app.listen(PORT, () => {
  console.log(`Server corriendo en puerto ${PORT}`);
});
