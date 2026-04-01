const axios = require('axios');
require('dotenv').config();

async function testAxios() {
    const url = `${process.env.MAIL_SERVICE_BASE_URL}/send`;
    console.log('Testing URL:', url);
    try {
        const res = await axios.post(url, {
            to: 'test@example.com',
            subject: 'Test',
            html: '<p>Test</p>'
        }, { timeout: 5000 });
        console.log('Response:', res.status, res.data);
    } catch (err) {
        console.error('Axios Error Message:', err.message);
        console.error('Axios Error Code:', err.code);
        if (err.response) console.log('Error Data:', err.response.data);
    }
}

testAxios();
