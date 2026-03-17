const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();

const PORT = process.env.PORT || 3000;
const PASTES_DIR = path.join(__dirname, 'pastes');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Página principal con formulario
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Mi Paste Raw - Protected by bxl VM</title>
      <style>
        body { font-family: monospace; background: #111; color: #eee; padding: 2rem; margin: 0; }
        textarea { width: 100%; height: 300px; background: #222; color: #0f0; border: 1px solid #444; padding: 1rem; font-size: 1rem; }
        button { padding: 1rem 2rem; background: #0f0; color: #000; border: none; cursor: pointer; font-size: 1.2rem; }
        button:hover { background: #0c0; }
      </style>
    </head>
    <body>
      <h1>Pega tu texto crudo bro</h1>
      <p>Después de crear, usa el link /view/ID para ver protegido</p>
      <form method="POST" action="/paste">
        <textarea name="text" placeholder="Aquí tu código, log, config, lo que sea..."></textarea><br><br>
        <button type="submit">Crear Paste Raw</button>
      </form>
    </body>
    </html>
  `);
});

// Crear nuevo paste
app.post('/paste', async (req, res) => {
  const text = req.body.text || '';
  if (!text.trim()) {
    return res.status(400).send('<h1>Nada que pegar, bro :(</h1><a href="/">Volver</a>');
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const filePath = path.join(PASTES_DIR, `${id}.txt`);

  try {
    await fs.mkdir(PASTES_DIR, { recursive: true });
    await fs.writeFile(filePath, text, 'utf8');

    const rawUrl = `${req.protocol}://${req.get('host')}/raw/${id}`;
    const viewUrl = `${req.protocol}://${req.get('host')}/view/${id}`;

    res.send(`
      <h1>¡Listo, Angel!</h1>
      <p>Link raw (texto plano puro): <strong><a href="${rawUrl}">${rawUrl}</a></strong></p>
      <p>Link protegido (con capa negra): <strong><a href="${viewUrl}">${viewUrl}</a></strong></p>
      <p>En terminal: <code>curl ${rawUrl}</code></p>
      <h3>Preview (primeras líneas):</h3>
      <pre>${text.slice(0, 500)}${text.length > 500 ? '...\n(más líneas ocultas)' : ''}</pre>
      <a href="/">Crear otro</a>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('<h1>Error al guardar :(</h1><a href="/">Volver</a>');
  }
});

// Servir el raw puro (sin protección visual)
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

// Ruta protegida: capa 100% negra opaca
app.get('/view/:id', async (req, res) => {
  const filePath = path.join(PASTES_DIR, `${req.params.id}.txt`);
  try {
    const content = await fs.readFile(filePath, 'utf8');

    const escapedContent = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Protected by bxl VM</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body, html { height:100%; overflow:hidden; background:#000; font-family:Consolas,monospace; color:#fff; }
          .container { position:relative; height:100vh; width:100vw; }
          pre { 
            position:absolute; top:0; left:0; width:100%; height:100%; 
            padding:2rem; white-space:pre-wrap; word-wrap:break-word; overflow:auto; 
            background:#0d1117; color:#c9d1d9; font-size:1rem; line-height:1.5;
          }
          .overlay { 
            position:absolute; top:0; left:0; width:100%; height:100%; 
            background:#000; z-index:9999; display:flex; align-items:center; justify-content:center;
            pointer-events:all;
          }
          .message { 
            font-size:2.8rem; font-weight:bold; color:#ff0044; text-align:center;
            text-shadow:0 0 15px #000, 0 0 30px #ff0044;
            padding:1.5rem 3rem; background:rgba(0,0,0,0.7); border:4px solid #ff0044; border-radius:12px;
            max-width:90%;
          }
          body, .overlay { user-select:none; -webkit-user-select:none; -moz-user-select:none; -ms-user-select:none; }
        </style>
      </head>
      <body>
        <div class="container">
          <pre>${escapedContent}</pre>
          <div class="overlay">
            <div class="message">This script is protected by bxl VM</div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(404).send('Paste no encontrado');
  }
});

app.listen(PORT, () => {
  console.log(`Server corriendo en puerto ${PORT}`);
});
