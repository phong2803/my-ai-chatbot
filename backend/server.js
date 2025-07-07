// Nạp các thư viện cần thiết
require('dotenv').config(); // Để đọc file .env
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');

// Lấy API keys từ file .env một cách an toàn
const FPT_API_KEY = process.env.FPT_API_KEY;
const CHATBASE_API_KEY = process.env.CHATBASE_API_KEY;

// Khởi tạo Express app
const app = express();
const port = 3000; // Backend sẽ chạy ở cổng 3000

// Cấu hình
app.use(cors()); // Cho phép cross-origin requests
app.use(express.json()); // Cho phép đọc JSON từ body của request
const upload = multer({ storage: multer.memoryStorage() }); // Cấu hình để nhận file trong bộ nhớ

// --- CÁC ĐƯỜNG DẪN (API ENDPOINTS) ---

// 1. Endpoint cho Chatbase
app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;

        const response = await fetch('https://www.chatbase.co/api/v1/chat', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CHATBASE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [{ content: userMessage, role: 'user' }],
                chatbotId: 'fQ9R8KFVCa2pnpWp82_yU', // Chatbot ID của bạn
                stream: false, // Tạm thời không dùng stream để đơn giản hóa
                model: 'gpt-4o',
            }),
        });

        const data = await response.json();
        res.json({ botMessage: data.content }); // Gửi tin nhắn của bot về frontend

    } catch (error) {
        console.error('Error in /chat endpoint:', error);
        res.status(500).json({ error: 'Failed to get response from Chatbase' });
    }
});

// 2. Endpoint cho Speech-to-Text (FPT.AI)
app.post('/stt', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    try {
        const audioBuffer = req.file.buffer;
        const fptResponse = await fetch('https://api.fpt.ai/hmi/asr/general', {
            method: 'POST',
            headers: { 'api-key': FPT_API_KEY },
            body: audioBuffer,
        });

        const data = await fptResponse.json();
        res.json(data); // Gửi kết quả nhận dạng về frontend

    } catch (error) {
        console.error('Error in /stt endpoint:', error);
        res.status(500).json({ error: 'Failed to process speech' });
    }
});

// 3. Endpoint cho Text-to-Speech (FPT.AI)
app.post('/tts', async (req, res) => {
    try {
        const text = req.body.text;
        const fptResponse = await fetch('https://api.fpt.ai/hmi/tts/v5', {
            method: 'POST',
            headers: {
                'api-key': FPT_API_KEY,
                'Content-Type': 'application/json',
                'voice': 'banmai'
            },
            body: JSON.stringify({ 'text': text })
        });

        const data = await fptResponse.json();
        res.json(data); // Gửi link audio về cho frontend

    } catch (error) {
        console.error('Error in /tts endpoint:', error);
        res.status(500).json({ error: 'Failed to synthesize speech' });
    }
});


// Khởi động server
app.listen(port, () => {
    console.log(`✅ Backend server listening at http://localhost:${port}`);
});