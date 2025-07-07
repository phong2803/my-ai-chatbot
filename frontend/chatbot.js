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
        const data = await response.json();
        if (data.async) {
            const audio = new Audio(data.async);
            audio.play();
        } else {
            console.error('TTS did not return a valid URL:', data);
        }
    } catch (error) {
        console.error('Error with Text-to-Speech:', error);
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

// Hàm gửi tin nhắn (gọi đến backend)
async function sendMessage() {
    const messageInput = document.getElementById('message');
    const message = messageInput.value;
    const chatWindow = document.getElementById('chat-window');
    if (message.trim() === '') return;

    // Hiển thị tin nhắn người dùng
    const userMessageDiv = document.createElement('div');
    userMessageDiv.classList.add('chat-message', 'user-message');
    userMessageDiv.innerText = message;
    chatWindow.appendChild(userMessageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    messageInput.value = '';

    // Hiển thị placeholder cho tin nhắn bot
    const botMessageDiv = document.createElement('div');
    botMessageDiv.classList.add('chat-message', 'bot-message');
    botMessageDiv.innerText = '...'; // Dấu hiệu bot đang "suy nghĩ"
    chatWindow.appendChild(botMessageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        // Gửi tin nhắn đến backend
        const response = await fetch(`${BACKEND_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });

        const data = await response.json();
        const botMessage = data.botMessage;

        // Cập nhật tin nhắn của bot và phát âm thanh
        botMessageDiv.innerText = botMessage;
        speakText(botMessage);

    } catch (error) {
        console.error('Error sending message:', error);
        botMessageDiv.innerText = 'Sorry, an error occurred.';
    }
}

// Event listener cho nút Enter và nút micro
document.getElementById('message').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
// Đảm bảo nút mic được gán đúng sự kiện
document.getElementById('mic-button').addEventListener('click', startSpeechToText);