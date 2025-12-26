import { saveFile } from './fileSystemAccess.js';

let videoStream = null;
let mediaRecorder = null; // For streaming upload
let localMediaRecorder = null; // For local saving
let recordedChunks = []; // For local saving

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
        try { videoStream.getTracks().forEach(track => track.stop()); } catch (e) { }
        videoStream = null;
    }
    if (videoElementId) {
        const video = document.getElementById(videoElementId);
        if (video) video.srcObject = null;
    }
}

export async function getVideoDevices() {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true }).then(s => s.getTracks().forEach(t => t.stop()));
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(d => d.kind === 'videoinput').map(d => ({ deviceId: d.deviceId, label: d.label }));
    } catch (e) { return []; }
}


// --- NEW LOCAL SAVING LOGIC ---

/**
 * Takes a picture, saves it locally, and returns a blob URL for display.
 * @param {string} videoElementId The ID of the video element.
 * @param {string} fileName The desired file name for the saved image.
 * @returns {Promise<string>} A promise that resolves with the blob URL of the image.
 */
export async function takePictureAndSave(videoElementId, fileName) {
    return new Promise((resolve) => {
        const video = document.getElementById(videoElementId);
        if (!video) {
            resolve(null);
            return;
        };

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
            if (blob) {
                await saveFile(fileName, blob);
                resolve(URL.createObjectURL(blob));
            } else {
                resolve(null);
            }
        }, "image/jpeg", 0.9);
    });
}

/**
 * Starts recording the video for local saving.
 * @param {string} videoElementId The ID of the video element.
 */
export function startRecordingLocal(videoElementId) {
    const video = document.getElementById(videoElementId);
    const stream = video ? video.srcObject : videoStream;
    if (!stream) return false;

    recordedChunks = [];
    let mimeType = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mimeType = 'video/webm;codecs=vp9';
    
    const options = { mimeType };
    localMediaRecorder = new MediaRecorder(stream, options);

    localMediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    localMediaRecorder.start();
    return true;
}

/**
 * Stops local recording, saves the video, and returns a blob URL for display.
 * @param {string} fileName The desired file name for the saved video.
 * @returns {Promise<string>} A promise that resolves with the blob URL of the video.
 */
export async function stopRecordingAndSaveLocal(fileName) {
    return new Promise((resolve) => {
        if (!localMediaRecorder || localMediaRecorder.state === "inactive") {
            resolve(null);
            return;
        }

        localMediaRecorder.onstop = async () => {
            const completeBlob = new Blob(recordedChunks, { type: localMediaRecorder.mimeType });
            await saveFile(fileName, completeBlob);
            recordedChunks = [];
            resolve(URL.createObjectURL(completeBlob));
        };

        localMediaRecorder.stop();
    });
}


// --- OLD UPLOAD LOGIC (Kept for reference or alternative use) ---

// This function now only returns the object URL, the upload is separate.
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

export function startRecordingStream(videoElementId, fileName, apiUrl) {
    const video = document.getElementById(videoElementId);
    const stream = video ? video.srcObject : videoStream;
    if (!stream) return false;
    
    uploadQueue = Promise.resolve();

    try {
        let mimeType = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mimeType = 'video/webm;codecs=vp9';
        else if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';

        const options = { mimeType: mimeType, videoBitsPerSecond: 2500000 };
        mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                uploadQueue = uploadQueue.then(async () => {
                    try {
                        await uploadChunkCore(event.data, fileName, apiUrl);
                    } catch (err) {
                        console.error("Lỗi upload chunk video:", err);
                    }
                });
            }
        };
        
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
            await uploadQueue;
            console.log("Recording stopped and all chunks uploaded.");
            resolve(true);
        };
        
        mediaRecorder.stop();
    });
}

async function uploadChunkCore(blob, fileName, apiUrl) {
    const formData = new FormData();
    formData.append("chunk", blob);
    
    const res = await fetch(`${apiUrl}/${fileName}`, {
        method: "POST",
        body: formData
    });
    
    if (!res.ok) throw new Error("Server rejected chunk");
}

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