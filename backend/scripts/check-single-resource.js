const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: 'dcmrsdydh',
    api_key: '516369855465939',
    api_secret: 'C4UC2KURVT_S4kAtYQzwdCbCk3M',
    secure: true
});

async function run() {
    try {
        const res = await cloudinary.api.resource('vnkxk5xvdjdszidiynub');
        console.log('Resource found successfully:', JSON.stringify(res, null, 2));
    } catch (err) {
        console.error('Resource NOT found via API:', err);
    }
}

run();
