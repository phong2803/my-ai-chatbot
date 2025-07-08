// === KHÔNG CÒN API KEY Ở ĐÂY ===
// URL của backend server
const BACKEND_URL = 'https://my-ai-chatbot-utz9.onrender.com';

// Biến toàn cục cho Speech-to-Text
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Biến toàn cục mới để lưu lịch sử cuộc trò chuyện
// Mỗi phần tử sẽ là một đối tượng { role: 'user' | 'assistant', content: 'tin nhắn' }
let conversationHistory = []; 

// Hàm Text-to-Speech (gọi đến backend đã dùng OpenAI)
async function speakText(text) {
    if (!text || text.trim() === '') return;
    try {
        const response = await fetch(`${BACKEND_URL}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) {
            console.error('Backend TTS returned an error. Status:', response.status);
            const errorDetails = await response.text();
            console.error('Error details:', errorDetails);
            return;
        }

        // OpenAI TTS stream trực tiếp file audio dưới dạng Blob
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        const audio = new Audio(audioUrl);
        audio.play().catch(e => {
            console.error("Lỗi khi phát âm thanh từ URL Blob:", audioUrl, e);
            // Có thể thêm thông báo cho người dùng nếu trình duyệt chặn autoplay
            // alert("Trình duyệt có thể đã chặn tự động phát âm thanh. Vui lòng tương tác với trang để bật âm thanh.");
        });

        // Giải phóng URL Blob sau khi audio kết thúc để tránh rò rỉ bộ nhớ
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
        };

    } catch (error) {
        console.error('Lỗi với Text-to-Speech:', error);
    }
}

// Hàm Speech-to-Text (gọi đến backend đã dùng OpenAI Whisper)
async function startSpeechToText() {
    const micButton = document.getElementById('mic-button');
    if (isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        micButton.classList.remove('recording');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecording = true;
        micButton.classList.add('recording');
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const formData = new FormData();
            formData.append('audio', audioBlob); // Backend đang mong đợi tên field là 'audio'

            try {
                // Gửi file âm thanh đến backend
                const response = await fetch(`${BACKEND_URL}/stt`, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                
                // OpenAI STT trả về kết quả trong trường 'text'
                if (data && data.text) { 
                    document.getElementById('message').value = data.text;
                } else {
                    document.getElementById('message').value = "Sorry, I could not understand.";
                }
            } catch (error) {
                console.error('Error with Speech-to-Text:', error);
            } finally {
                stream.getTracks().forEach(track => track.stop());
            }
        };
        mediaRecorder.start();
    } catch (error) {
        console.error('Error accessing microphone:', error);
        isRecording = false;
        micButton.classList.remove('recording');
    }
}

// Hàm gửi tin nhắn (gọi đến backend) - Đã được chỉnh sửa để có ngữ cảnh
async function sendMessage() {
    const messageInput = document.getElementById('message');
    const message = messageInput.value.trim(); // Dùng .trim() để loại bỏ khoảng trắng thừa
    const chatWindow = document.getElementById('chat-window');
    if (message === '') return; // Kiểm tra tin nhắn rỗng sau trim

    // Thêm tin nhắn người dùng vào lịch sử và hiển thị lên UI
    conversationHistory.push({ role: 'user', content: message }); 
    const userMessageDiv = document.createElement('div');
    userMessageDiv.classList.add('chat-message', 'user-message');
    userMessageDiv.innerText = message;
    chatWindow.appendChild(userMessageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    messageInput.value = '';

    // Hiển thị placeholder cho tin nhắn bot
    const botMessageDiv = document.createElement('div');
    botMessageDiv.classList.add('chat-message', 'bot-message');
    botMessageDiv.innerText = '...'; 
    chatWindow.appendChild(botMessageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        // Gửi TOÀN BỘ lịch sử cuộc trò chuyện đến backend
        const response = await fetch(`${BACKEND_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: conversationHistory }) 
        });

        const data = await response.json();
        const botMessage = data.botMessage;

        // Cập nhật tin nhắn của bot và thêm vào lịch sử
        botMessageDiv.innerText = botMessage;
        conversationHistory.push({ role: 'assistant', content: botMessage }); // Thêm tin nhắn bot vào lịch sử
        speakText(botMessage); // Đảm bảo dòng này không bị comment nếu bạn muốn voice

    } catch (error) {
        console.error('Error sending message:', error);
        botMessageDiv.innerText = 'Sorry, an error occurred.';
        // Nếu có lỗi, loại bỏ tin nhắn người dùng cuối cùng khỏi lịch sử để không làm sai lệch ngữ cảnh
        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
            conversationHistory.pop();
        }
    }
}

// Event listener cho nút Enter và nút micro
document.getElementById('message').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
// Đảm bảo nút mic được gán đúng sự kiện
document.getElementById('mic-button').addEventListener('click', startSpeechToText);