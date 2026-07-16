const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = __dirname;
const FRAMES_DIR = path.join(__dirname, 'frames');

// Helper to determine Content-Type
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.fbx': 'application/octet-stream',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const { method, url } = req;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (method === 'POST') {
    if (url === '/api/record/start') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          // Re-create frames directory
          if (fs.existsSync(FRAMES_DIR)) {
            // Delete all files in frames directory
            const files = fs.readdirSync(FRAMES_DIR);
            for (const file of files) {
              fs.unlinkSync(path.join(FRAMES_DIR, file));
            }
          } else {
            fs.mkdirSync(FRAMES_DIR, { recursive: true });
          }
          console.log('\n[Server] Started recording. Cleaned/created frames/ directory.');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', message: 'Frames directory cleared and ready.' }));
        } catch (err) {
          console.error('[Server] Error starting record:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (url === '/api/record/frame') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });

      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const { frameIndex, image } = payload;
          
          if (frameIndex === undefined || !image) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing frameIndex or image data' }));
            return;
          }

          // Extract base64 content
          const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');

          // Generate file name
          const fileName = `frame_${String(frameIndex).padStart(6, '0')}.jpg`;
          const filePath = path.join(FRAMES_DIR, fileName);

          fs.writeFile(filePath, buffer, (err) => {
            if (err) {
              console.error(`[Server] Error saving ${fileName}:`, err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
            // Log progress occasionally to avoid console spam
            if (frameIndex % 60 === 0) {
              console.log(`[Server] Saved frame #${frameIndex} (${fileName})`);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', frameIndex }));
          });
        } catch (err) {
          console.error('[Server] Parse error in frame save:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (url === '/api/record/stop') {
      console.log('[Server] Stopped recording.');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
  }

  // Serve static files
  if (method === 'GET') {
    let filePath = path.join(PUBLIC_DIR, url === '/' ? 'index.html' : decodeURIComponent(url));
    
    // Safety check to prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Accept-Ranges': 'bytes'
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  }
});

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  MV Rendering Server running at:`);
  console.log(`  http://localhost:${PORT}/`);
  console.log(`  `);
  console.log(`  Frames will be saved to:`);
  console.log(`  ${FRAMES_DIR}`);
  console.log(`==================================================`);
});
