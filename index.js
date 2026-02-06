const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const qrcode = require('qrcode-terminal');
const pino = require('pino');

// Configuración de la IA - Modelo 2026
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('--- ESCANEA EL QR ABAJO ---');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ BOT CONECTADO Y ACTIVO 24/7');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const text = m.message.conversation || m.message.extendedTextMessage?.text || "";

        if (text.toLowerCase().startsWith('!bot ')) {
            const prompt = text.replace('!bot ', '').trim();
            
            try {
                // Efecto "escribiendo..."
                await sock.sendPresenceUpdate('composing', m.key.remoteJid);
                
                const result = await model.generateContent(prompt);
                const response = result.response.text();

                await sock.sendMessage(m.key.remoteJid, { 
                    text: `@bot ${response}` 
                }, { quoted: m });

            } catch (error) {
                console.error("Error:", error);
                await sock.sendMessage(m.key.remoteJid, { text: "@bot Error al conectar con Gemini 2.0." });
            }
        }
    });
}

connectToWhatsApp();
