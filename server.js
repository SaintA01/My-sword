// server.js - RAILWAY VERSION
import express from 'express';
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import cors from 'cors';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

// Auto-create sessions folder
if (!fs.existsSync('./sessions')) {
  fs.mkdirSync('./sessions', { recursive: true });
}

app.post('/api/start', async (req, res) => {
  console.log('🚀 Starting WhatsApp on Railway...');
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./sessions');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: { level: 'warn' },
      browser: ['Ubuntu', 'Chrome', '110.0.0'],
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
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!qrSent) {
        res.status(408).json({ 
          error: 'QR timeout - try again',
          message: 'WhatsApp servers are slow to respond'
        });
      }
    }, 30000);

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
    service: 'WhatsApp Bot - Railway',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ WhatsApp Bot running on Railway - Port ${PORT}`);
});
