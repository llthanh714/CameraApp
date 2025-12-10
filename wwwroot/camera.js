let videoStream = null;
let mediaRecorder = null;
let dotNetHelperRef = null;

// Hàng đợi upload để đảm bảo thứ tự các chunk video (Chunk 1 -> Chunk 2 -> Chunk 3...)
let uploadQueue = Promise.resolve();

// --- Theme & Settings (Giữ nguyên) ---
export function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}
export function getSavedTheme() { return localStorage.getItem('theme') || 'dark'; }
export function saveSettings(settings) { localStorage.setItem('cameraSettings', JSON.stringify(settings)); }
export function getSavedSettings() {
    const s = localStorage.getItem('cameraSettings');
    return s ? JSON.parse(s) : null;
}

// --- Shortcuts (Giữ nguyên) ---
function handleKeyboardEvent(event) {
    if (!dotNetHelperRef) return;
    if (event.code === 'Space' && event.target.tagName !== 'INPUT') {
        event.preventDefault(); 
        dotNetHelperRef.invokeMethodAsync('TriggerCapture');
    }
}
export function registerShortcuts(dotNetHelper) {
    dotNetHelperRef = dotNetHelper;
    window.addEventListener('keydown', handleKeyboardEvent);
}
export function unregisterShortcuts() {
    window.removeEventListener('keydown', handleKeyboardEvent);
    dotNetHelperRef = null;
}
export function revokeUrl(url) {
    if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

// --- Camera Setup (Giữ nguyên) ---
export async function startCamera(videoElementId, deviceId, width, height, frameRate) {
    const video = document.getElementById(videoElementId);
    if (!video) return;
    if (videoStream) videoStream.getTracks().forEach(track => track.stop());

    const constraints = {
        video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: width ? { ideal: width } : undefined,
            height: height ? { ideal: height } : undefined,
            frameRate: frameRate ? { ideal: frameRate } : undefined
        },
        audio: true
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoStream = stream;
        video.srcObject = stream;
    } catch (err) {
        console.error("Camera Error:", err);
        if (constraints.audio) {
            constraints.audio = false;
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                videoStream = stream;
                video.srcObject = stream;
            } catch (err2) { alert("Không thể mở camera: " + err2.message); }
        }
    }
}

export function stopCamera(videoElementId) {
    if (videoStream) {
        try { videoStream.getTracks().forEach(track => track.stop()); } catch (e) {}
        videoStream = null;
    }
    if (videoElementId) {
        const video = document.getElementById(videoElementId);
        if (video) video.srcObject = null;
    }
}

export async function takePicture(videoElementId) {
    const video = document.getElementById(videoElementId);
    if (video) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(URL.createObjectURL(blob));
            }, "image/jpeg", 0.85);
        });
    }
    return null;
}

export async function getVideoDevices() {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true }).then(s => s.getTracks().forEach(t => t.stop()));
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(d => d.kind === 'videoinput').map(d => ({ deviceId: d.deviceId, label: d.label }));
    } catch (e) { return []; }
}

// --- NEW RECORDING LOGIC (STREAMING) ---

// Hàm này giờ nhận thêm fileName và apiUrl để upload ngay lập tức
export function startRecordingStream(videoElementId, fileName, apiUrl) {
    const video = document.getElementById(videoElementId);
    const stream = video ? video.srcObject : videoStream;
    if (!stream) return false;
    
    // Reset hàng đợi upload
    uploadQueue = Promise.resolve();

    try {
        // Ưu tiên codec VP9 hoặc H264 để file WebM/MP4 dễ đọc
        let mimeType = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mimeType = 'video/webm;codecs=vp9';
        else if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4'; // Một số trình duyệt mới hỗ trợ ghi mp4 trực tiếp

        const options = { mimeType: mimeType, videoBitsPerSecond: 2500000 };
        mediaRecorder = new MediaRecorder(stream, options);

        // Sự kiện này sẽ bắn ra liên tục mỗi N giây (do ta set timeSlice ở hàm start)
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                // Thêm việc upload vào hàng đợi (Queue)
                // Chunk sau phải đợi chunk trước upload xong mới được chạy
                uploadQueue = uploadQueue.then(async () => {
                    try {
                        await uploadChunkCore(event.data, fileName, apiUrl);
                    } catch (err) {
                        console.error("Lỗi upload chunk video:", err);
                        // Có thể thêm logic retry ở đây nếu muốn
                    }
                });
            }
        };

        // Bắt đầu ghi và cắt chunk mỗi 1000ms (1 giây)
        mediaRecorder.start(1000); 
        console.log("Started recording stream to:", fileName);
        return true;
    } catch (err) {
        console.error("Error starting recording:", err);
        return false;
    }
}

export async function stopRecordingStream() {
    return new Promise((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            resolve(true);
            return;
        }
        
        mediaRecorder.onstop = async () => {
            // Đợi tất cả các chunk còn lại trong hàng đợi upload xong
            await uploadQueue;
            console.log("Recording stopped and all chunks uploaded.");
            resolve(true);
        };
        
        mediaRecorder.stop();
    });
}

// Hàm core upload (Helper)
async function uploadChunkCore(blob, fileName, apiUrl) {
    const formData = new FormData();
    formData.append("chunk", blob);
    
    // Gọi API C#
    const res = await fetch(`${apiUrl}/${fileName}`, {
        method: "POST",
        body: formData
    });
    
    if (!res.ok) throw new Error("Server rejected chunk");
}

// Giữ lại hàm upload ảnh cũ (cho tính năng chụp ảnh)
export async function uploadMedia(fileUrl, fileName, apiUrl) {
    try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        return uploadChunkCore(blob, fileName, apiUrl).then(() => true).catch(() => false);
    } catch (error) {
        console.error("Lỗi upload ảnh:", error);
        return false;
    }
}