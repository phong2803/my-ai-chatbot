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
        if (data && data.text) {
            res.json({ botMessage: data.text });
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
        console.log('Received TTS request for text:', text); // Log để kiểm tra

        const fptResponse = await fetch('https://api.fpt.ai/hmi/tts/v5', {
            method: 'POST',
            headers: {
                'api-key': FPT_API_KEY,
                'Content-Type': 'application/json',
                'voice': 'banmai'
            },
            body: JSON.stringify({ 'text': text })
        });

        const initialFptData = await fptResponse.json();
        console.log('Initial FPT.AI TTS response:', initialFptData); // Log phản hồi ban đầu

        // Kiểm tra xem có phải là async link không
        if (initialFptData && initialFptData.async) {
            const asyncUrl = initialFptData.async;
            console.log('FPT.AI returned an async link, fetching final audio from:', asyncUrl);

            // Chờ một khoảng thời gian ngắn để FPT.AI xử lý (ví dụ: 2 giây)
            await new Promise(resolve => setTimeout(resolve, 4000)); 

            // Fetch lại link async để lấy file MP3 thực sự
            const finalAudioResponse = await fetch(asyncUrl);

            if (finalAudioResponse.ok) {
                // FPT.AI API trả về file audio trực tiếp
                // Bạn có thể trả về URL hoặc stream trực tiếp file audio
                const finalAudioUrl = finalAudioResponse.url; // Lấy URL cuối cùng sau redirect
                console.log('Final audio URL obtained:', finalAudioUrl);
                res.json({ audioUrl: finalAudioUrl }); // Trả về chỉ URL MP3 cho frontend
            } else {
                const errorBody = await finalAudioResponse.text();
                console.error('Failed to fetch final audio from async link. Status:', finalAudioResponse.status, 'Body:', errorBody);
                return res.status(500).json({ error: 'Failed to fetch final audio from FPT.AI async link', details: errorBody });
            }

        } else if (initialFptData && initialFptData.data && initialFptData.data.url) {
            // Trường hợp FPT.AI trả về link trực tiếp (ít phổ biến với API v5 async)
            console.log('FPT.AI returned direct audio URL:', initialFptData.data.url);
            res.json({ audioUrl: initialFptData.data.url }); // Trả về chỉ URL MP3 cho frontend
        } else {
            console.error('FPT.AI TTS response invalid or missing expected URL:', initialFptData);
            res.status(500).json({ error: 'FPT.AI TTS response invalid', details: initialFptData });
        }

    } catch (error) {
        console.error('Error in /tts endpoint:', error);
        res.status(500).json({ error: 'Failed to synthesize speech', details: error.message });
    }
});


// Khởi động server
app.listen(port, () => {
    console.log(`✅ Backend server listening at http://localhost:${port}`);
});