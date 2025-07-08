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

// === BIẾN MỚI CHO CHỨC NĂNG TTS BẰNG NÚT ===
let currentAudio = null; // Để lưu đối tượng Audio hiện tại
let isSpeaking = false; // Trạng thái đang nói hay không

// Hàm Text-to-Speech (gọi đến backend đã dùng OpenAI)
// Hàm này giờ sẽ tải âm thanh nhưng KHÔNG TỰ ĐỘNG PHÁT.
// Nó trả về một Promise giải quyết với URL Blob (hoặc null nếu lỗi).
async function getAudioBlobUrl(text) {
    if (!text || text.trim() === '') return null;
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
            return null;
        }

        const audioBlob = await response.blob();
        return URL.createObjectURL(audioBlob);

    } catch (error) {
        console.error('Lỗi khi lấy audio từ TTS:', error);
        return null;
    }
}

// Hàm điều khiển việc phát/dừng âm thanh
async function toggleSpeech() {
    const speakerButton = document.getElementById('speaker-button');
    const chatWindow = document.getElementById('chat-window');
    const lastBotMessageDiv = chatWindow.querySelector('.bot-message:last-child');
    
    // Lấy tin nhắn cuối cùng của bot
    const lastBotMessage = conversationHistory.findLast(msg => msg.role === 'assistant');
    if (!lastBotMessage || !lastBotMessage.content) {
        console.warn("Không tìm thấy tin nhắn bot để phát.");
        return;
    }

    if (isSpeaking && currentAudio) {
        // Nếu đang nói, thì dừng
        currentAudio.pause();
        currentAudio.currentTime = 0; // Reset về đầu
        isSpeaking = false;
        speakerButton.classList.remove('speaking');
        speakerButton.title = 'Speak Response'; // Đổi tooltip
        console.log("TTS stopped.");
        if (lastBotMessageDiv) lastBotMessageDiv.classList.remove('speaking-active');

    } else {
        // Nếu chưa nói hoặc đã dừng, thì bắt đầu nói
        speakerButton.classList.add('speaking');
        speakerButton.title = 'Stop Speaking'; // Đổi tooltip
        if (lastBotMessageDiv) lastBotMessageDiv.classList.add('speaking-active');


        // Nếu chưa có audio hoặc là tin nhắn mới, tải audio mới
        if (!currentAudio || currentAudio.ended || currentAudio.src !== lastBotMessage.audioUrl) {
             // Lưu URL Blob vào lịch sử để không tải lại nhiều lần
            if (!lastBotMessage.audioUrl) {
                lastBotMessage.audioUrl = await getAudioBlobUrl(lastBotMessage.content);
            }
            
            if (lastBotMessage.audioUrl) {
                if (currentAudio) {
                    URL.revokeObjectURL(currentAudio.src); // Giải phóng URL cũ nếu có
                }
                currentAudio = new Audio(lastBotMessage.audioUrl);
                currentAudio.onended = () => {
                    isSpeaking = false;
                    speakerButton.classList.remove('speaking');
                    speakerButton.title = 'Speak Response';
                    if (lastBotMessageDiv) lastBotMessageDiv.classList.remove('speaking-active');
                    URL.revokeObjectURL(lastBotMessage.audioUrl); // Giải phóng URL sau khi nói xong
                    lastBotMessage.audioUrl = undefined; // Đánh dấu là không còn URL nữa
                    currentAudio = null; // Xóa tham chiếu
                };
                currentAudio.play().catch(e => {
                    console.error("Lỗi khi phát âm thanh:", e);
                    isSpeaking = false;
                    speakerButton.classList.remove('speaking');
                    speakerButton.title = 'Speak Response';
                    if (lastBotMessageDiv) lastBotMessageDiv.classList.remove('speaking-active');
                    alert("Trình duyệt có thể đã chặn tự động phát âm thanh. Vui lòng tương tác với trang để bật âm thanh.");
                });
                isSpeaking = true;
            } else {
                console.error("Không thể lấy audio URL để phát.");
                isSpeaking = false;
                speakerButton.classList.remove('speaking');
                speakerButton.title = 'Speak Response';
                if (lastBotMessageDiv) lastBotMessageDiv.classList.remove('speaking-active');
            }
        } else {
            // Nếu đã có audio và là cùng một tin nhắn, chỉ cần resume
            currentAudio.play().catch(e => {
                console.error("Lỗi khi resume âm thanh:", e);
                isSpeaking = false;
                speakerButton.classList.remove('speaking');
                speakerButton.title = 'Speak Response';
                if (lastBotMessageDiv) lastBotMessageDiv.classList.remove('speaking-active');
            });
            isSpeaking = true;
        }
        console.log("TTS started/resumed.");
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
    const message = messageInput.value.trim(); 
    const chatWindow = document.getElementById('chat-window');
    if (message === '') return; 

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

    // Khi có tin nhắn mới, dừng nếu đang phát âm thanh cũ
    if (isSpeaking && currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        isSpeaking = false;
        document.getElementById('speaker-button').classList.remove('speaking');
        document.getElementById('speaker-button').title = 'Speak Response';
        if (currentAudio.src.startsWith('blob:')) {
            URL.revokeObjectURL(currentAudio.src);
        }
        currentAudio = null;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: conversationHistory }) 
        });

        const data = await response.json();
        const botMessage = data.botMessage;

        botMessageDiv.innerText = botMessage;
        conversationHistory.push({ role: 'assistant', content: botMessage }); 
        
        // --- KHÔNG CÒN GỌI speakText(botMessage) TỰ ĐỘNG Ở ĐÂY NỮA ---
        // Giờ đây người dùng sẽ ấn nút loa để nói

    } catch (error) {
        console.error('Error sending message:', error);
        botMessageDiv.innerText = 'Sorry, an error occurred.';
        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
            conversationHistory.pop();
        }
    }
}

// Event listener cho nút Enter và nút micro
document.getElementById('message').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

document.getElementById('mic-button').addEventListener('click', startSpeechToText);

// === THÊM EVENT LISTENER CHO NÚT LOA MỚI ===
document.getElementById('speaker-button').addEventListener('click', toggleSpeech);