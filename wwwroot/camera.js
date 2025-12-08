// wwwroot/camera.js
let videoStream;
let mediaRecorder;
let currentFileName = "";

export async function startCamera(videoElementId) {
    try {
        const video = document.getElementById(videoElementId);
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        video.srcObject = videoStream;
    } catch (err) {
        console.error("Lỗi camera:", err);
    }
}

// Hàm quay video mới: Nhận tên file từ C# để gửi đúng chỗ
export function startRecordingStream(fileName) {
    currentFileName = fileName;

    // mimeType: 'video/webm; codecs=vp8' giúp file ổn định hơn khi nối ghép
    const options = { mimeType: 'video/webm; codecs=vp8' };
    mediaRecorder = new MediaRecorder(videoStream, options);

    // Sự kiện này kích hoạt mỗi khi có một phân đoạn dữ liệu (chunk)
    mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
            await sendChunkToSrver(e.data, currentFileName);
        }
    };

    // start(1000) nghĩa là cắt và gửi dữ liệu mỗi 1000ms (1 giây)
    mediaRecorder.start(1000);
}

export function stopRecordingStream() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}

// Hàm phụ: Gửi chunk lên API bằng fetch
async function sendChunkToSrver(blob, fileName) {
    const formData = new FormData();
    formData.append("chunk", blob);

    try {
        // Gọi API Controller chúng ta vừa tạo ở Bước 1
        await fetch(`/api/video/append/${fileName}`, {
            method: "POST",
            body: formData
        });
    } catch (err) {
        console.error("Lỗi gửi chunk lên server:", err);
    }
}

export function captureImage(videoElementId) {
    const video = document.getElementById(videoElementId);
    const canvas = document.createElement("canvas");
    // Đặt kích thước canvas bằng kích thước thật của video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    // Vẽ frame hiện tại của video lên canvas
    canvas.getContext('2d').drawImage(video, 0, 0);
    // Trả về chuỗi Base64 định dạng JPEG chất lượng 0.9 (90%)
    return canvas.toDataURL("image/jpeg", 0.9);
}