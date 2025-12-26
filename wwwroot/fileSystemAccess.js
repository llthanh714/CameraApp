// This variable will hold the directory handle.
let directoryHandle;

// Opens a directory picker and stores the selected directory handle.
export async function selectDirectory() {
    try {
        directoryHandle = await window.showDirectoryPicker();
        if (directoryHandle) {
            return true;
        }
    } catch (err) {
        console.error("Error selecting directory:", err);
    }
    return false;
}

// Saves a file with the given name and content to the selected directory.
export async function saveFile(fileName, content) {
    if (!directoryHandle) {
        alert("Please select a directory first.");
        return;
    }

    try {
        // Get a handle for the file, creating it if it doesn't exist.
        const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
        
        // Create a writable stream.
        const writable = await fileHandle.createWritable();
        
        // Write the content to the stream.
        // The content can be a string, Blob, or BufferSource.
        await writable.write(content);
        
        // Close the stream and write the file to disk.
        await writable.close();
        
        console.log(`File "${fileName}" saved successfully.`);
    } catch (err) {
        console.error(`Error saving file "${fileName}":`, err);
    }
}
