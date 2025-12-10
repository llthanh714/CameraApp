let videoStream = null;
let mediaRecorder = null;
let recordedChunks = [];

// --- Theme & Settings Logic ---
export function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

export function getSavedTheme() {
    return localStorage.getItem('theme') || 'dark';
}

// Lưu cấu hình camera
export function saveSettings(settings) {
    localStorage.setItem('cameraSettings', JSON.stringify(settings));
}

// Tải cấu hình camera
export function getSavedSettings() {
    const settings = localStorage.getItem('cameraSettings');
    return settings ? JSON.parse(settings) : null;
}

// --- Camera Logic ---
export async function startCamera(videoElementId, deviceId, width, height, frameRate) {
    const video = document.getElementById(videoElementId);
    if (!video) return;

    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
    }

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
        console.error("Lỗi truy cập camera: ", err);
        // Fallback nếu lỗi audio
        if (constraints.audio) {
            constraints.audio = false;
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                videoStream = stream;
                video.srcObject = stream;
            } catch (err2) {
                alert("Không thể khởi động camera: " + err2.message);
            }
        }
    }
}

export function stopCamera(videoElementId) {
    const video = document.getElementById(videoElementId);
    if (video && video.srcObject) {
        const stream = video.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
        videoStream = null;
    }
}

export async function takePicture(videoElementId) {
    const video = document.getElementById(videoElementId);
    const canvas = document.createElement("canvas");
    if (video) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/png");
    }
    return null;
}

export async function getVideoDevices() {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true }).then(s => s.getTracks().forEach(t => t.stop()));
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices
            .filter(device => device.kind === 'videoinput')
            .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 5)}...` }));
    } catch (error) {
        console.error("Lỗi lấy danh sách thiết bị:", error);
        return [];
    }
}

export function startRecording(videoElementId) {
    const video = document.getElementById(videoElementId);
    if (!video || !video.srcObject) return false;
    recordedChunks = [];
    const stream = video.srcObject;
    try {
        const options = { mimeType: 'video/webm' };
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            options.mimeType = 'video/webm;codecs=vp9';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            options.mimeType = 'video/mp4';
        }
        mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        mediaRecorder.start();
        return true;
    } catch (err) {
        console.error("Error starting recording:", err);
        return false;
    }
}

export async function stopRecording() {
    return new Promise((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            resolve(null);
            return;
        }
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
            const url = URL.createObjectURL(blob);
            recordedChunks = [];
            resolve(url);
        };
        mediaRecorder.stop();
    });
}

export async function uploadMedia(fileUrl, fileName, apiUrl) {
    try {
        // 1. Chuyển đổi URL (Blob hoặc Base64) thành đối tượng Blob thực tế
        const response = await fetch(fileUrl);
        const blob = await response.blob();

        // 2. Tạo FormData để gửi dữ liệu (khớp với [FromForm] IFormFile chunk trong C#)
        const formData = new FormData();
        formData.append("chunk", blob);

        // 3. Gọi API Backend
        // URL sẽ là: api/Video/append/{fileName}
        const uploadRes = await fetch(`${apiUrl}/${fileName}`, {
            method: "POST",
            body: formData
        });

        return uploadRes.ok;
    } catch (error) {
        console.error("Lỗi upload:", error);
        return false;
    }
}