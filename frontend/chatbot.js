// === KHÔNG CÒN API KEY Ở ĐÂY ===
// URL của backend server
const BACKEND_URL = 'https://my-ai-chatbot-utz9.onrender.com';

// Lấy các phần tử DOM
const userInput = document.getElementById('message');
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');
const speakerButton = document.getElementById('speaker-button');
const chatWindow = document.getElementById('chat-window');

// LẤY CÁC NÚT MỚI TỪ HTML
const cancelRecordButton = document.getElementById('cancel-record-button');
const confirmRecordButton = document.getElementById('confirm-record-button');

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


// --- HÀM MỚI: toggleRecordButtons (để hiển thị/ẩn các nút) ---
function toggleRecordButtons(show) {
    if (show) {
        // Đang ghi âm: Ẩn các nút thông thường, hiện nút điều khiển ghi âm
        micButton.style.display = 'none';
        sendButton.style.display = 'none';
        speakerButton.style.display = 'none';

        cancelRecordButton.style.display = 'inline-block';
        confirmRecordButton.style.display = 'inline-block';
    } else {
        // Không ghi âm: Hiện các nút thông thường, ẩn nút điều khiển ghi âm
        micButton.style.display = 'inline-block';
        sendButton.style.display = 'inline-block';
        speakerButton.style.display = 'inline-block';

        cancelRecordButton.style.display = 'none';
        confirmRecordButton.style.display = 'none';
    }
}


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
    const lastBotMessageDiv = chatWindow.querySelector('.bot-message:last-child');

    // Lấy tin nhắn cuối cùng của bot từ conversationHistory
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
        speakerButton.title = 'Nghe tin nhắn bot'; // Đổi tooltip
        console.log("TTS stopped.");
        if (lastBotMessageDiv) lastBotMessageDiv.classList.remove('speaking-active');
    } else {
        // Nếu chưa nói hoặc đã dừng, thì bắt đầu nói
        speakerButton.classList.add('speaking');
        speakerButton.title = 'Dừng phát âm thanh'; // Đổi tooltip
        if (lastBotMessageDiv) lastBotMessageDiv.classList.add('speaking-active');

        // Nếu chưa có audio hoặc là tin nhắn mới, tải audio mới
        // Dùng lastBotMessage.audioUrl để kiểm tra và lưu trữ URL
        if (!currentAudio || currentAudio.ended || currentAudio.src !== (lastBotMessage.audioUrl || null)) {
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
                    speakerButton.title = 'Nghe tin nhắn bot';
                    if (lastBotMessageDiv) lastBotMessageDiv.classList.remove('speaking-active');
                    // Không revokeObjectURL ở đây nữa vì audioUrl đã được lưu trong conversationHistory
                    // Nó sẽ được revoke khi conversationHistory được reset hoặc khi trình duyệt đóng tab
                    currentAudio = null; // Xóa tham chiếu
                };
                currentAudio.play().catch(e => {
                    console.error("Lỗi khi phát âm thanh:", e);
                    isSpeaking = false;
                    speakerButton.classList.remove('speaking');
                    speakerButton.title = 'Nghe tin nhắn bot';
                    if (lastBotMessageDiv) lastBotMessageDiv.classList.remove('speaking-active');
                    alert("Trình duyệt có thể đã chặn tự động phát âm thanh. Vui lòng tương tác với trang để bật âm thanh.");
                });
                isSpeaking = true;
            } else {
                console.error("Không thể lấy audio URL để phát.");
                isSpeaking = false;
                speakerButton.classList.remove('speaking');
                speakerButton.title = 'Nghe tin nhắn bot';
                if (lastBotMessageDiv) lastBotMessageDiv.classList.remove('speaking-active');
            }
        } else {
            // Nếu đã có audio và là cùng một tin nhắn, chỉ cần resume
            currentAudio.play().catch(e => {
                console.error("Lỗi khi resume âm thanh:", e);
                isSpeaking = false;
                speakerButton.classList.remove('speaking');
                speakerButton.title = 'Nghe tin nhắn bot';
                if (lastBotMessageDiv) lastBotMessageDiv.classList.remove('speaking-active');
            });
            isSpeaking = true;
        }
        console.log("TTS started/resumed.");
    }
}


// --- CẬP NHẬT: Hàm Speech-to-Text (chỉ bắt đầu ghi âm, không dừng) ---
async function startSpeechToText() {
    if (isRecording) {
        // Nếu đang ghi âm mà gọi lại hàm này, thì bỏ qua
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecording = true;
        micButton.classList.add('recording'); // Thêm class để đổi màu/hiệu ứng cho nút mic
        toggleRecordButtons(true); // Hiển thị nút X và V, ẩn các nút khác

        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            // Xử lý dữ liệu chỉ khi có audioChunks (tức là không bị hủy bởi nút X)
            if (audioChunks.length > 0) {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Sử dụng webm cho tương thích tốt hơn
                const formData = new FormData();
                formData.append('audio', audioBlob); // Backend đang mong đợi tên field là 'audio'

                try {
                    const response = await fetch(`${BACKEND_URL}/stt`, {
                        method: 'POST',
                        body: formData
                    });
                    const data = await response.json();

                    if (data && data.text) {
                        userInput.value = data.text; // Đặt văn bản đã chuyển đổi vào ô input
                    } else {
                        userInput.value = "Sorry, I could not understand.";
                    }
                } catch (error) {
                    console.error('Error with Speech-to-Text:', error);
                    userInput.value = "Error converting speech to text.";
                }
            } else {
                console.log('Recording stopped but no audio data to send (likely cancelled).');
            }
            // Luôn dừng stream và reset trạng thái sau khi ghi âm kết thúc
            stream.getTracks().forEach(track => track.stop());
            isRecording = false; // Đặt lại trạng thái ghi âm
            micButton.classList.remove('recording'); // Xóa hiệu ứng
            toggleRecordButtons(false); // Hiển thị lại các nút ban đầu
        };
        mediaRecorder.start();
        console.log('Recording started...');
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Không thể truy cập micro. Vui lòng kiểm tra quyền truy cập.');
        isRecording = false;
        micButton.classList.remove('recording');
        toggleRecordButtons(false); // Đảm bảo ẩn các nút X/V nếu ghi âm không bắt đầu được
    }
}


// Hàm gửi tin nhắn (gọi đến backend) - Đã được chỉnh sửa để có ngữ cảnh
async function sendMessage() {
    const message = userInput.value.trim();
    if (message === '') return;

    // Thêm tin nhắn người dùng vào lịch sử và hiển thị lên UI
    conversationHistory.push({ role: 'user', content: message });
    const userMessageDiv = document.createElement('div');
    userMessageDiv.classList.add('chat-message', 'user-message');
    userMessageDiv.innerText = message;
    chatWindow.appendChild(userMessageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    userInput.value = '';

    // Hiển thị placeholder cho tin nhắn bot
    const botMessageDiv = document.createElement('div');
    botMessageDiv.classList.add('chat-message', 'bot-message');
    botMessageDiv.innerText = '...';
    chatWindow.appendChild(botMessageDiv);
    chatWindow.scrollTop = chatWindow.ConvscrollY;

    // Khi có tin nhắn mới, dừng nếu đang phát âm thanh cũ
    if (isSpeaking && currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        isSpeaking = false;
        speakerButton.classList.remove('speaking');
        speakerButton.title = 'Nghe tin nhắn bot';
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
            conversationHistory.pop(); // Xóa tin nhắn người dùng nếu lỗi để không làm sai lịch sử
        }
    }
}


// Event listener cho nút Enter và các nút hành động
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

micButton.addEventListener('click', startSpeechToText); // Nút mic chỉ dùng để BẮT ĐẦU ghi âm

// === THÊM EVENT LISTENER CHO CÁC NÚT MỚI ===
cancelRecordButton.addEventListener('click', () => {
    if (isRecording && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); // Dừng ghi âm. onstop sẽ được gọi nhưng audioChunks sẽ RỖNG
        // isRecording, class, và toggleButtons sẽ được xử lý trong mediaRecorder.onstop
        audioChunks = []; // Quan trọng: Xóa dữ liệu để onstop không gửi đi
        console.log('Recording cancelled.');
    }
});

confirmRecordButton.addEventListener('click', () => {
    if (isRecording && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); // Dừng ghi âm. onstop sẽ được gọi VÀ XỬ LÝ DỮ LIỆU
        // isRecording, class, và toggleButtons sẽ được xử lý trong mediaRecorder.onstop
        console.log('Recording stopped and preparing to send.');
    }
});

speakerButton.addEventListener('click', toggleSpeech); // Nút speaker để điều khiển TTS