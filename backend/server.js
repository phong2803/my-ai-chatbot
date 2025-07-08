// Nạp các thư viện cần thiết
require('dotenv').config(); // Để đọc file .env
const express = require('express');
const cors = require('cors'); // Đảm bảo gói 'cors' đã được cài đặt: npm install cors
const multer = require('multer');
const fetch = require('node-fetch'); // node-fetch là cần thiết cho các cuộc gọi fetch trong Node.js
const FormData = require('form-data'); // THÊM DÒNG NÀY ĐỂ SỬ DỤNG THƯ VIỆN FORM-DATA CHO NODE.JS

// Lấy API keys từ file .env một cách an toàn
const CHATBASE_API_KEY = process.env.CHATBASE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Thêm dòng này để lấy OpenAI API Key

// Khởi tạo Express app
const app = express();
// Render sẽ cung cấp cổng qua biến môi trường PORT, KHÔNG phải cứng mã 3000
const port = process.env.PORT || 3000; 

// Cấu hình Multer cho việc xử lý file
// Dùng memoryStorage để lưu file vào bộ nhớ, phù hợp cho các file nhỏ
const upload = multer({ storage: multer.memoryStorage() }); 

// --- CẤU HÌNH CORS (PHẢI NẰM Ở ĐÂY VÀ TRƯỚC TẤT CẢ CÁC MIDDLEWARE KHÁC VÀ ROUTES) ---
// Định nghĩa các nguồn (origins) được phép truy cập backend của bạn
const allowedOrigins = [
    'https://thuoc-quanh-nha.netlify.app', // Tên miền chính thức của frontend bạn trên Netlify
    'http://localhost:3000',               // Nếu bạn đang chạy frontend cục bộ trên cổng 3000
    'http://localhost:8080'                // Nếu bạn đang chạy frontend cục bộ trên cổng 8080 (hoặc cổng nào đó bạn đang dùng)
];

app.use(cors({
    origin: function (origin, callback) {
        // Cho phép các yêu cầu không có origin (ví dụ: từ Postman, cURL, hoặc server-to-server)
        if (!origin) return callback(null, true); 
        // Kiểm tra xem origin của yêu cầu có nằm trong danh sách được phép không
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Các phương thức HTTP được phép
    credentials: true, // Cho phép gửi cookies, authorization headers, v.v. (quan trọng cho xác thực)
    optionsSuccessStatus: 204 // Trả về mã trạng thái 204 cho yêu cầu preflight thành công
}));
// --- KẾT THÚC CẤU HÌNH CORS ---

// Cho phép đọc JSON từ body của request (PHẢI NẰM SAU CORS, TRƯỚC CÁC ROUTES)
app.use(express.json()); 


// --- CÁC ĐƯỜNG DẪN (API ENDPOINTS) ---
app.post('/chat', upload.none(), async (req, res) => { 
    try {
        // THAY ĐỔI LỚN Ở ĐÂY: Nhận mảng tin nhắn từ frontend
        // Frontend sẽ gửi một payload có dạng { messages: [...] }
        const messages = req.body.messages; 

        // Log: Xác nhận yêu cầu từ frontend đã đến đây và xem lịch sử
        console.log('Received conversation history from frontend:', messages); 

        // Lấy tin nhắn cuối cùng của người dùng (tùy chọn, để log rõ hơn)
        const userMessage = messages[messages.length - 1]?.content;
        console.log('User\'s current message:', userMessage);

        console.log('CHATBASE_API_KEY (loaded):', CHATBASE_API_KEY ? 'Yes' : 'No'); 
        console.log('Chatbot ID (in code):', 'fQ9R8KFVCa2pnpWp82_yU'); 

        const chatbaseRequestPayload = {
            // THAY ĐỔI LỚN Ở ĐÂY: Gửi toàn bộ mảng messages
            messages: messages, // Gửi toàn bộ lịch sử cuộc trò chuyện
            chatbotId: 'fQ9R8KFVCa2pnpWp82_yU', 
            stream: false,
            model: 'gpt-4o',
        };
        console.log('Sending payload to Chatbase:', JSON.stringify(chatbaseRequestPayload)); 

        const response = await fetch('https://www.chatbase.co/api/v1/chat', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CHATBASE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(chatbaseRequestPayload),
        });

        console.log('Received raw response from Chatbase. HTTP Status:', response.status); 

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Chatbase API returned an error (response.ok is false):', response.status, errorText); 
            return res.status(response.status).json({ 
                error: `Chatbase API error: ${response.status}`, 
                details: errorText 
            });
        }

        const data = await response.json();
        console.log('Chatbase parsed data (success):', data); 
        
        // SỬA ĐỊNH DẠNG PHẢN HỒI CHO FRONTEND TẠI ĐÂY
        // Frontend mong đợi một trường tên là 'botMessage', không phải 'text'
        if (data && data.text) { 
            res.json({ botMessage: data.text }); // Đổi 'text' thành 'botMessage'
        } else {
            console.error('Chatbase response missing expected content or is empty:', data); 
            res.status(500).json({ error: 'Chatbase response valid but missing bot content', details: data });
        }

    } catch (error) {
        console.error('CRITICAL ERROR in /chat endpoint (caught by try/catch):', error.message, error.stack); 
        res.status(500).json({ error: 'Failed to get response from Chatbase due to an unexpected server error.' });
    }
});

// --- 2. Endpoint cho Speech-to-Text (OpenAI Whisper) ---
app.post('/stt', upload.single('audio'), async (req, res) => { // Dùng upload.single('audio') để xử lý file audio
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    try {
        const audioBuffer = req.file.buffer;
        
        // ✅ THAY ĐỔI LỚN TẠI ĐÂY: Dùng form-data đúng chuẩn Node.js
        const formData = new FormData(); // KHÔNG Dùng new Blob() ở đây nữa

        // Append file với tên 'file' (OpenAI yêu cầu), buffer và thông tin file gốc
        formData.append('file', audioBuffer, {
            filename: req.file.originalname, // Tên file gốc từ client
            contentType: req.file.mimetype // Loại MIME của file (ví dụ: 'audio/webm')
        });
        formData.append('model', 'whisper-1');
        formData.append('language', 'vi'); // Rất quan trọng để chỉ định ngôn ngữ là tiếng Việt

        const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                ...formData.getHeaders() // ✅ RẤT QUAN TRỌNG: Tự động thêm Content-Type và boundary
            },
            body: formData,
        });

        const data = await openaiResponse.json();
        console.log('OpenAI STT response:', data);

        if (!openaiResponse.ok) {
            console.error('OpenAI STT API returned an error:', openaiResponse.status, data);
            return res.status(openaiResponse.status).json({ error: 'OpenAI STT API error', details: data });
        }

        if (data && data.text) {
            res.json({ text: data.text }); // Trả về text đã chuyển đổi
        } else {
            console.error('OpenAI STT response missing expected text:', data);
            res.status(500).json({ error: 'OpenAI STT response invalid', details: data });
        }

    } catch (error) {
        console.error('Error in /stt endpoint with OpenAI:', error);
        res.status(500).json({ error: 'Failed to process speech with OpenAI', details: error.message });
    }
});

// --- 3. Endpoint cho Text-to-Speech (OpenAI TTS) ---
app.post('/tts', async (req, res) => {
    try {
        const text = req.body.text;
        console.log('Received TTS request for text:', text);

        const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "tts-1", // Hoặc "tts-1-hd" cho chất lượng cao hơn
                input: text,
                voice: "nova", // Chọn một trong 6 giọng phù hợp: alloy, echo, fable, onyx, nova, shimmer
                response_format: "mp3"
            })
        });

        if (!openaiResponse.ok) {
            const errorBody = await openaiResponse.text();
            console.error('OpenAI TTS API returned an error:', openaiResponse.status, errorBody);
            return res.status(openaiResponse.status).json({ error: 'OpenAI TTS API error', details: errorBody });
        }

        // OpenAI trả về trực tiếp file audio dưới dạng stream
        res.setHeader('Content-Type', 'audio/mpeg'); // Đặt Content-Type là audio/mpeg cho file mp3
        openaiResponse.body.pipe(res); // Chuyển trực tiếp stream từ OpenAI về client

    } catch (error) {
        console.error('Error in /tts endpoint with OpenAI:', error);
        res.status(500).json({ error: 'Failed to synthesize speech', details: error.message });
    }
});


// Khởi động server
// Server sẽ lắng nghe trên cổng được cung cấp bởi Render (process.env.PORT)
app.listen(port, () => {
    console.log(`✅ Backend server listening at http://localhost:${port}`);
});