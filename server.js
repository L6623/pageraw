const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const short = require('short-uuid');
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
      <title>Mi Paste Raw - Angel</title>
      <style>
        body { font-family: monospace; background: #111; color: #eee; padding: 2rem; margin: 0; }
        textarea { width: 100%; height: 300px; background: #222; color: #0f0; border: 1px solid #444; padding: 1rem; font-size: 1rem; }
        button { padding: 1rem 2rem; background: #0f0; color: #000; border: none; cursor: pointer; font-size: 1.2rem; }
        button:hover { background: #0c0; }
        pre { background: #000; padding: 1rem; overflow: auto; max-height: 400px; }
      </style>
    </head>
    <body>
      <h1>Pega tu texto crudo bro</h1>
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

  const id = short.generate().slice(0, 10); // 10 chars para que sea más corto y legible
  const filePath = path.join(PASTES_DIR, `${id}.txt`);

  try {
    await fs.mkdir(PASTES_DIR, { recursive: true });
    await fs.writeFile(filePath, text, 'utf8');

    const rawUrl = `${req.protocol}://${req.get('host')}/raw/${id}`;
    res.send(`
      <h1>¡Listo, Angel!</h1>
      <p>Tu paste raw: <strong><a href="${rawUrl}">${rawUrl}</a></strong></p>
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

// Servir el raw puro (text/plain)
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

app.listen(PORT, () => {
  console.log(`Server corriendo en puerto ${PORT} - http://localhost:${PORT}`);
});
