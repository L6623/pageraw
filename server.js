const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const short = require('short-uuid');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Página principal (formulario para pegar texto)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Mi Paste Raw</title></head>
    <body style="font-family:monospace; background:#111; color:#eee; padding:2rem;">
      <h1>Pega tu texto crudo</h1>
      <form method="POST" action="/paste">
        <textarea name="text" rows="15" cols="80" style="width:100%; background:#222; color:#0f0; font-family:monospace;"></textarea><br><br>
        <button type="submit">Crear Paste Raw</button>
      </form>
    </body>
    </html>
  `);
});

// Crear paste
app.post('/paste', async (req, res) => {
  const text = req.body.text || '';
  if (!text.trim()) return res.status(400).send('Nada que pegar bro');

  const id = short.generate().slice(0, 8); // ID corto tipo pastebin
  const filePath = path.join(__dirname, 'pastes', `${id}.txt`);

  await fs.mkdir(path.join(__dirname, 'pastes'), { recursive: true });
  await fs.writeFile(filePath, text);

  const rawUrl = `${req.protocol}://${req.get('host')}/raw/${id}`;
  res.send(`
    <h1>¡Listo!</h1>
    <p>Tu paste raw: <a href="${rawUrl}">${rawUrl}</a></p>
    <p>curl ${rawUrl} para verlo en terminal</p>
    <pre>${text.slice(0, 300)}${text.length > 300 ? '...' : ''}</pre>
  `);
});

// Servir raw puro (¡esto es lo clave!)
app.get('/raw/:id', async (req, res) => {
  const filePath = path.join(__dirname, 'pastes', `${req.params.id}.txt`);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (e) {
    res.status(404).send('Paste no encontrado :(');
  }
});

app.listen(3000, () => console.log('Server corriendo en http://localhost:3000'));
