// server.js - CYCLIC VERSION
import express from 'express';
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import cors from 'cors';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

// Auto-create sessions folder
if (!fs.existsSync('/tmp/sessions')) {
  fs.mkdirSync('/tmp/sessions', { recursive: true });
}

app.post('/api/start', async (req, res) => {
  console.log('🚀 Starting WhatsApp on Cyclic...');
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState('/tmp/sessions');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: { level: 'warn' },
      browser: ['Ubuntu', 'Chrome', '110.0.0'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 15000
    });

    sock.ev.on('creds.update', saveCreds);

    let qrSent = false;

    sock.ev.on('connection.update', (update) => {
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
        console.log('🎉 WhatsApp Connected!');
      }
    });

    // Timeout after 45 seconds
    setTimeout(() => {
      if (!qrSent) {
        res.status(408).json({ 
          error: 'QR timeout', 
          message: 'Try again in a moment' 
        });
      }
    }, 45000);

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      error: 'Failed: ' + error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'WhatsApp Bot - Cyclic',
    timestamp: new Date().toISOString()
  });
});

// Serve simple frontend
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Bot - Cyclic</title>
        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
        <style>
            body { font-family: Arial; padding: 40px; text-align: center; }
            button { padding: 15px 30px; font-size: 18px; margin: 20px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; }
            #qr { margin: 20px auto; display: inline-block; background: white; padding: 20px; border-radius: 10px; }
            #status { padding: 15px; border-radius: 8px; margin: 20px 0; }
            .success { background: #059669; color: white; }
            .error { background: #dc2626; color: white; }
        </style>
    </head>
    <body>
        <h1>🚀 WhatsApp Bot on Cyclic</h1>
        <button onclick="startSession()">Generate QR Code</button>
        
        <div id="qrContainer" style="display:none">
            <h3>Scan this QR with WhatsApp:</h3>
            <div id="qr"></div>
            <p>📱 WhatsApp → Settings → Linked Devices → Link a Device</p>
        </div>
        
        <div id="status">Ready to start...</div>

        <script>
            async function startSession() {
                document.getElementById('status').textContent = '🔄 Connecting to WhatsApp...';
                document.getElementById('status').className = '';
                
                try {
                    const response = await fetch('/api/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    const data = await response.json();
                    
                    if (data.qr) {
                        document.getElementById('qrContainer').style.display = 'block';
                        document.getElementById('qr').innerHTML = '';
                        
                        QRCode.toCanvas(document.getElementById('qr'), data.qr, {
                            width: 250,
                            margin: 2
                        });
                        
                        document.getElementById('status').textContent = '✅ QR Ready! Scan with WhatsApp within 2 minutes';
                        document.getElementById('status').className = 'success';
                    } else {
                        document.getElementById('status').textContent = '❌ Error: ' + (data.error || 'Unknown error');
                        document.getElementById('status').className = 'error';
                    }
                } catch (error) {
                    document.getElementById('status').textContent = '❌ Failed: ' + error.message;
                    document.getElementById('status').className = 'error';
                }
            }
        </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ WhatsApp Bot running on Cyclic - Port ${PORT}`);
});
