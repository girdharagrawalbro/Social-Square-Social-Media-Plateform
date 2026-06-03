const axios = require('axios');

async function testDrive() {
  const GDRIVE_API_BASE_URL = 'https://gdrive-lr06.onrender.com';
  console.log('Testing GDrive microservice:', GDRIVE_API_BASE_URL);
  try {
    // Attempt to test with a dummy request to upload-url or similar
    // The microservice might have a health check or we can try upload-url with a dummy URL
    const response = await axios.post(`${GDRIVE_API_BASE_URL}/api/drive/upload-url`, {
      url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=100',
      folder: 'backups/test',
      name: 'test-image.jpg'
    });
    console.log('Success response:', response.data);
  } catch (error) {
    console.error('Error response:', error.response?.data || error.message);
  }
}

testDrive();
