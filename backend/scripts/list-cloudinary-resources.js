const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: 'dcmrsdydh',
    api_key: '516369855465939',
    api_secret: 'C4UC2KURVT_S4kAtYQzwdCbCk3M',
    secure: true
});

async function run() {
    try {
        console.log('Listing resources...');
        const res = await cloudinary.api.resources({ max_results: 10 });
        console.log('Found resources:', JSON.stringify(res.resources, null, 2));
    } catch (err) {
        console.error('Failed to list resources:', err);
    }
}

run();
