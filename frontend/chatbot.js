// === KHÔNG CÒN API KEY Ở ĐÂY ===
// URL của backend server
const BACKEND_URL = 'https://my-ai-chatbot-utz9.onrender.com';

// Biến toàn cục cho Speech-to-Text
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Hàm Text-to-Speech (gọi đến backend)
async function speakText(text) {
    if (!text || text.trim() === '') return;
    try {
        const response = await fetch(`${BACKEND_URL}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });
        const data = await response.json(); // Backend giờ sẽ trả về { audioUrl: "link_mp3_thực_sự" }

        // Kiểm tra xem backend có trả về audioUrl hợp lệ không
        if (data && data.audioUrl) {
            const audio = new Audio(data.audioUrl); // Sử dụng link MP3 trực tiếp từ backend
            audio.play().catch(e => {
                console.error("Lỗi khi phát âm thanh từ URL:", data.audioUrl, e);
                // Bạn có thể thêm thông báo lỗi cho người dùng ở đây nếu muốn
            });
        } else {
            console.error('Backend TTS did not return a valid audioUrl:', data);
        }
    } catch (error) {
        console.error('Lỗi với Text-to-Speech:', error);
    }
}

// Hàm Speech-to-Text (gọi đến backend)
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
            formData.append('audio', audioBlob); // Đặt tên field là 'audio'

            try {
                // Gửi file âm thanh đến backend
                const response = await fetch(`${BACKEND_URL}/stt`, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.hypotheses && data.hypotheses.length > 0) {
                    document.getElementById('message').value = data.hypotheses[0].utterance;
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

// --- HÀM MỚI ĐỂ HIỂN THỊ TIN NHẮN (MESSAGE APPENDER) ---
function appendMessage(sender, text) {
    const chatWindow = document.getElementById('chat-window');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', `${sender}-message`);

    const textContent = document.createElement('p');
    textContent.textContent = text;
    messageDiv.appendChild(textContent);

    // Thêm nút 'Đọc' chỉ cho tin nhắn của bot
    if (sender === 'bot') {
        const readButton = document.createElement('button');
        readButton.textContent = '🔊 Đọc'; // Biểu tượng loa và chữ "Đọc"
        readButton.classList.add('read-button'); // Thêm class để CSS
        readButton.onclick = () => speakText(text); // Gán sự kiện click để gọi speakText

        messageDiv.appendChild(readButton);
    }

    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight; // Cuộn xuống cuối
}


// Hàm gửi tin nhắn (gọi đến backend)
async function sendMessage() {
    const messageInput = document.getElementById('message');
    const message = messageInput.value;
    // const chatWindow = document.getElementById('chat-window'); // Không cần tham chiếu trực tiếp đến chatWindow ở đây nữa
    if (message.trim() === '') return;

    // Hiển thị tin nhắn người dùng (sử dụng hàm appendMessage mới)
    appendMessage('user', message);
    messageInput.value = '';

    // Hiển thị placeholder cho tin nhắn bot
    // Lưu tham chiếu đến div này để cập nhật sau
    const botMessagePlaceholderDiv = document.createElement('div');
    botMessagePlaceholderDiv.classList.add('chat-message', 'bot-message');
    botMessagePlaceholderDiv.innerText = '...'; // Dấu hiệu bot đang "suy nghĩ"
    document.getElementById('chat-window').appendChild(botMessagePlaceholderDiv);
    document.getElementById('chat-window').scrollTop = document.getElementById('chat-window').scrollHeight;

    try {
        // Gửi tin nhắn đến backend
        const response = await fetch(`${BACKEND_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });

        const data = await response.json();
        const botMessage = data.botMessage;

        // Xóa placeholder và hiển thị tin nhắn thật của bot
        botMessagePlaceholderDiv.remove(); // Xóa placeholder
        appendMessage('bot', botMessage); // Hiển thị tin nhắn thực tế của bot với nút

    } catch (error) {
        console.error('Lỗi khi gửi tin nhắn:', error);
        // Nếu xảy ra lỗi, cập nhật placeholder bằng thông báo lỗi
        botMessagePlaceholderDiv.innerText = 'Xin lỗi, đã xảy ra lỗi.';
    }
}

// Event listener cho nút Enter và nút micro
document.getElementById('message').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
// Đảm bảo nút mic được gán đúng sự kiện
document.getElementById('mic-button').addEventListener('click', startSpeechToText);