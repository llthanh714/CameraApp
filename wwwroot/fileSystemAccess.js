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

// Saves a file with the given path and content to the selected directory,
// creating subdirectories as needed.
export async function saveFile(filePath, content) {
    if (!directoryHandle) {
        alert("Please select a directory first.");
        return;
    }

    try {
        const pathParts = filePath.split('/').filter(p => p);
        const fileName = pathParts.pop();
        
        let currentDirectoryHandle = directoryHandle;

        // Create subdirectories
        for (const part of pathParts) {
            currentDirectoryHandle = await currentDirectoryHandle.getDirectoryHandle(part, { create: true });
        }

        // Get a handle for the file, creating it if it doesn't exist.
        const fileHandle = await currentDirectoryHandle.getFileHandle(fileName, { create: true });
        
        // Create a writable stream.
        const writable = await fileHandle.createWritable();
        
        // Write the content to the stream.
        await writable.write(content);
        
        // Close the stream and write the file to disk.
        await writable.close();
        
        console.log(`File "${filePath}" saved successfully.`);
    } catch (err) {
        console.error(`Error saving file "${filePath}":`, err);
    }
}
