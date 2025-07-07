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

app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        // Log 1: Xác nhận yêu cầu từ frontend đã đến đây
        console.log('Received message from frontend:', userMessage); 

        // Log API Key và Chatbot ID để đảm bảo chúng được load và sử dụng
        console.log('CHATBASE_API_KEY (loaded):', CHATBASE_API_KEY ? 'Yes' : 'No'); 
        console.log('Chatbot ID (in code):', 'fQ9R8KFVCa2pnpWp82_yU'); 

        const chatbaseRequestPayload = {
            messages: [{ content: userMessage, role: 'user' }],
            chatbotId: 'fQ9R8KFVCa2pnpWp82_yU', // Đảm bảo ID này chính xác
            stream: false,
            model: 'gpt-4o',
        };
        // Log 2: Payload (dữ liệu) sẽ gửi tới Chatbase
        console.log('Sending payload to Chatbase:', JSON.stringify(chatbaseRequestPayload)); 

        const response = await fetch('https://www.chatbase.co/api/v1/chat', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CHATBASE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(chatbaseRequestPayload),
        });

        // Log 3: Trạng thái HTTP nhận được từ Chatbase API
        console.log('Received raw response from Chatbase. HTTP Status:', response.status); 

        // Kiểm tra nếu phản hồi từ Chatbase không thành công (ví dụ: 401, 403, 429, 500)
        if (!response.ok) {
            const errorText = await response.text();
            // Log 4: Lỗi chi tiết từ Chatbase API
            console.error('Chatbase API returned an error (response.ok is false):', response.status, errorText); 
            // Trả về lỗi chi tiết hơn cho frontend để tiện debug
            return res.status(response.status).json({ 
                error: `Chatbase API error: ${response.status}`, 
                details: errorText 
            });
        }

        const data = await response.json();
        // Log 5: Dữ liệu JSON đã parse được từ Chatbase (khi thành công)
        console.log('Chatbase parsed data (success):', data); 
        
        // Kiểm tra xem data.content có tồn tại và hợp lệ không
        if (data && data.content) {
            res.json({ botMessage: data.content });
        } else {
            // Log 6: Phản hồi từ Chatbase không có nội dung bot mong muốn
            console.error('Chatbase response missing expected content or is empty:', data); 
            res.status(500).json({ error: 'Chatbase response valid but missing bot content', details: data });
        }

    } catch (error) {
        // Log 7: Bất kỳ lỗi nào không mong muốn xảy ra trong quá trình thực thi
        console.error('CRITICAL ERROR in /chat endpoint (caught by try/catch):', error.message, error.stack); 
        res.status(500).json({ error: 'Failed to get response from Chatbase due to an unexpected server error.' });
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