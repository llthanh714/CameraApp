let videoStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let dotNetHelperRef = null;

// --- Theme & Settings Logic ---
export function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

export function getSavedTheme() {
    return localStorage.getItem('theme') || 'dark';
}

export function saveSettings(settings) {
    localStorage.setItem('cameraSettings', JSON.stringify(settings));
}

export function getSavedSettings() {
    const settings = localStorage.getItem('cameraSettings');
    return settings ? JSON.parse(settings) : null;
}

// --- Keyboard Shortcuts Logic ---
function handleKeyboardEvent(event) {
    if (!dotNetHelperRef) return;

    if (event.code === 'Space' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
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

// --- Memory Management (NEW) ---
export function revokeUrl(url) {
    if (url && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
        console.log("Revoked URL:", url);
    }
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
        if (constraints.audio) {
            constraints.audio = false; // Thử lại không cần mic
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                videoStream = stream;
                video.srcObject = stream;
            } catch (err2) {
                alert("Không thể khởi động camera (vui lòng kiểm tra quyền truy cập): " + err2.message);
            }
        }
    }
}

export function stopCamera(videoElementId) {
    if (videoStream) {
        try {
            videoStream.getTracks().forEach(track => track.stop());
        } catch (e) {}
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
                const url = URL.createObjectURL(blob);
                resolve(url);
            }, "image/jpeg", 0.85);
        });
    }
    return null;
}

export async function getVideoDevices() {
    try {
        // Yêu cầu quyền trước để lấy label
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
    const stream = video ? video.srcObject : videoStream;
    if (!stream) return false;
    
    recordedChunks = [];
    try {
        let mimeType = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mimeType = 'video/webm;codecs=vp9';
        else if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';

        const options = { mimeType: mimeType, videoBitsPerSecond: 2500000 };
        mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) recordedChunks.push(event.data);
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
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const formData = new FormData();
        formData.append("chunk", blob);

        // fileName đã được sanitize ở server, nhưng nên dùng tên clean từ client
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