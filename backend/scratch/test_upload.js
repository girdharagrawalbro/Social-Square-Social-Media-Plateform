const axios = require('axios');
const CLOUDINARY_URL = "https://cloudinary-service-mdl5.onrender.com/api/cloudinary/upload-base64";

async function test() {
    try {
        console.log("Uploading test payload...");
        const res = await axios.post(CLOUDINARY_URL, {
            file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        });
        console.log("Success:", res.data);
    } catch (err) {
        console.error("Failed:", err.message);
    }
}
test();
