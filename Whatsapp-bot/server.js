// server.js - FLY.IO VERSION
import express from 'express';
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import cors from 'cors';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

// Ensure sessions directory exists
if (!fs.existsSync('./sessions')) {
  fs.mkdirSync('./sessions', { recursive: true });
}

let activeSocket = null;

app.post('/api/start', async (req, res) => {
  console.log('🚀 Starting WhatsApp on Fly.io...');
  
  try {
    // Close previous connection if exists
    if (activeSocket) {
      try {
        await activeSocket.logout();
      } catch (e) {}
    }

    const { state, saveCreds } = await useMultiFileAuthState('./sessions');
    const { version } = await fetchLatestBaileysVersion();

    activeSocket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: { level: 'info' },
      browser: ['Ubuntu', 'Chrome', '110.0.0'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 15000
    });

    activeSocket.ev.on('creds.update', saveCreds);

    let qrSent = false;

    activeSocket.ev.on('connection.update', (update) => {
      console.log('📡 Connection:', update.connection);
      
      if (update.qr && !qrSent) {
        console.log('✅ QR Generated!');
        qrSent = true;
        res.json({ 
          success: true, 
          qr: update.qr,
          message: 'Scan with WhatsApp → Linked Devices'
        });
      }

      if (update.connection === 'open') {
        console.log('🎉 WhatsApp Connected Successfully!');
      }
    });

    // Timeout after 45 seconds
    setTimeout(() => {
      if (!qrSent) {
        res.status(408).json({ 
          error: 'QR timeout', 
          message: 'WhatsApp servers took too long to respond' 
        });
      }
    }, 45000);

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      error: 'Setup failed: ' + error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    platform: 'Fly.io',
    timestamp: new Date().toISOString()
  });
});

// Serve simple frontend
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Bot - Fly.io</title>
        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
        <style>
            body { font-family: Arial; padding: 40px; text-align: center; }
            button { padding: 15px 30px; font-size: 18px; margin: 20px; }
            #qr { margin: 20px auto; display: inline-block; background: white; padding: 20px; }
        </style>
    </head>
    <body>
        <h1>🚀 WhatsApp Bot on Fly.io</h1>
        <button onclick="startSession()">Generate QR Code</button>
        <div id="qr"></div>
        <div id="status"></div>
        
        <script>
            async function startSession() {
                document.getElementById('status').textContent = 'Connecting...';
                
                try {
                    const response = await fetch('/api/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    const data = await response.json();
                    
                    if (data.qr) {
                        document.getElementById('qr').innerHTML = '';
                        QRCode.toCanvas(document.getElementById('qr'), data.qr, {
                            width: 250,
                            margin: 2
                        });
                        document.getElementById('status').textContent = '✅ QR Ready! Scan with WhatsApp';
                    } else {
                        document.getElementById('status').textContent = 'Error: ' + (data.error || 'Unknown');
                    }
                } catch (error) {
                    document.getElementById('status').textContent = 'Failed: ' + error.message;
                }
            }
        </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ WhatsApp Bot running on Fly.io - Port ${PORT}`);
});
