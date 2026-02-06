const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const qrcode = require('qrcode-terminal');
const pino = require('pino');

// Configuración de la IA
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function connectToWhatsApp() {
    // Carpeta para guardar la sesión y no escanear siempre
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // DESACTIVADO para evitar el error de Koyeb
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Si hay un QR, lo imprimimos manualmente
        if (qr) {
            console.log('-------------------------------------------');
            console.log('VINCULA TU WHATSAPP ESCANEANDO EL QR ABAJO:');
            console.log('-------------------------------------------');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ BOT CONECTADO EXITOSAMENTE');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const text = m.message.conversation || m.message.extendedTextMessage?.text || "";

        if (text.toLowerCase().startsWith('!bot ')) {
            const prompt = text.replace('!bot ', '').trim();
            try {
                await sock.sendPresenceUpdate('composing', m.key.remoteJid);
                const result = await model.generateContent(prompt);
                const response = result.response.text();
                await sock.sendMessage(m.key.remoteJid, { text: `@bot ${response}` }, { quoted: m });
            } catch (error) {
                console.error("Error IA:", error);
                await sock.sendMessage(m.key.remoteJid, { text: "@bot Lo siento, hubo un error con mi cerebro virtual." });
            }
        }
    });
}

connectToWhatsApp();
