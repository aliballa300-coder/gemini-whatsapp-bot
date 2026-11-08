const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const AI_API_URL = `https://googleapis.com{GEMINI_API_KEY}`;

// تحديد مسار كروم تلقائياً داخل سيرفر ريندر
const chromePath = path.join(process.env.HOME, '.cache', 'puppeteer', 'chrome', 'linux-146.0.7680.31', 'chrome-linux64', 'chrome');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: chromePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('امسح كود الـ QR الظاهر في الأسفل برقم الواتساب الخاص بك:');
});

client.on('ready', () => {
    console.log('تم تشغيل البوت وربطه بالواتساب بنجاح!');
});

client.on('message', async (msg) => {
    try {
        if (msg.hasMedia && msg.type === 'image') {
            await msg.reply('جاري تحميل الصورة وتحليلها عبر Gemini...');
            const media = await msg.downloadMedia();

            const response = await axios.post(AI_API_URL, {
                contents: [{
                    parts: [
                        { text: msg.body || "اشرح هذه الصورة بالتفصيل" },
                        { inlineData: { mimeType: media.mimetype, data: media.data } }
                    ]
                }]
            }, { headers: { 'Content-Type': 'application/json' } });

            const replyText = response.data.candidates.content.parts.text;
            await msg.reply(replyText);
        } 
        else if (msg.type === 'chat') {
            const response = await axios.post(AI_API_URL, {
                contents: [{ parts: [{ text: msg.body }] }]
            }, { headers: { 'Content-Type': 'application/json' } });

            const replyText = response.data.candidates.content.parts.text;
            await msg.reply(replyText);
        }
    } catch (error) {
        console.error(error.message);
        await msg.reply('حدث خطأ أثناء معالجة طلبك بواسطة Gemini.');
    }
});

client.initialize();
