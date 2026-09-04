const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { checkImageNudity } = require('../services/moderationService');

async function test() {
    console.log('Testing Sightengine with a safe image (Google Logo)...');
    const safeUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSn7qpmvqrnh33nZEnZ3opbtO8kk3Wi6lsBsvXuPKp2seW8EtGsjfK54Mqw&s=10';
    const res = await checkImageNudity(safeUrl);
    console.log('Safe image check result:', JSON.stringify(res, null, 2));
}

test();
