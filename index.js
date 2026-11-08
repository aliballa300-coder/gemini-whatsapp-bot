import baileys from '@whiskeysockets/baileys';
const { default: makeWASocket, useMultiFileAuthState, disconnectReason, makeCacheableSignalKeyStore, downloadContentFromMessage } = baileys;
import qrcode from 'qrcode-terminal';
import axios from 'axios';
import pino from 'pino';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
// تصحيح الرابط الرسمي لـ Gemini واستخدام نموذج gemini-1.5-flash السريع والمجاني
const AI_API_URL = `https://googleapis.com{GEMINI_API_KEY}`;

// التوجيه السلوكي للبوت لكي يضحك ويتفاعل بعفوية مع الرسائل النصية
const SYSTEM_PROMPT = "أنت بوت واتساب شخصي مرح ومحبوب. تفاعل مع الناس بعفوية، اضحك معهم كثيراً باستخدام (ههههه، 😂، 🤣)، رد بأسلوب ذكي وودي، واجعل إجاباتك قصيرة ومناسبة لدردشة الواتساب.";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' }))
        },
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if(qr) {
            qrcode.generate(qr, { small: true });
            console.log('امسح كود الـ QR أعلاه برقم الواتساب الخاص بك:');
        }
        if(connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== disconnectReason.loggedOut;
            if(shouldReconnect) startBot();
        } else if(connection === 'open') {
            console.log('تم تشغيل البوت وربطه بالواتساب بنجاح! 🚀');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages;
        if (!msg[0].message || msg[0].key.fromMe) return;

        const messageData = msg[0];
        const from = messageData.key.remoteJid;
        const textMessage = messageData.message.conversation || messageData.message.extendedTextMessage?.text;
        const imageMessage = messageData.message.imageMessage;

        try {
            // التعامل مع الصور المرفوعة
            if (imageMessage) {
                await sock.sendMessage(from, { text: 'جاري تحميل الصورة وتحليلها عبر الذكاء الاصطناعي... 🧐📸' });
                const stream = await downloadContentFromMessage(imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await(const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
                const imageBase64 = buffer.toString('base64');

                const response = await axios.post(AI_API_URL, {
                    contents: [{
                        parts: [
                            { text: `انظر إلى هذه الصورة وعلق عليها بطريقة مرحة وتفاعلية بناءً على طلب المستخدم: ${imageMessage.caption || "اشرح الصورة"}` },
                            { inlineData: { mimeType: imageMessage.mimetype, data: imageBase64 } }
                        ]
                    }]
                }, { headers: { 'Content-Type': 'application/json' } });

                const replyText = response.data.candidates[0].content.parts[0].text;
                await sock.sendMessage(from, { text: replyText });
            } 
            // التعامل مع الرسائل النصية والضحك مع الناس
            else if (textMessage) {
                const response = await axios.post(AI_API_URL, {
                    contents: [
                        { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nرسالة المستخدم: ${textMessage}` }] }
                    ]
                }, { headers: { 'Content-Type': 'application/json' } });

                const replyText = response.data.candidates[0].content.parts[0].text;
                await sock.sendMessage(from, { text: replyText });
            }
        } catch (error) {
            console.error("حدث خطأ أثناء معالجة الذكاء الاصطناعي:", error.message);
        }
    });
}

startBot();
