/**
 * One-off script: Delete ALL active LiveKit rooms/sessions.
 * Run: node backend/scripts/cleanup-livekit-rooms.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { RoomServiceClient } = require('livekit-server-sdk');

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const url = process.env.LIVEKIT_URL;

if (!apiKey || !apiSecret || !url) {
    console.error('❌  Missing LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_URL in .env');
    process.exit(1);
}

const roomService = new RoomServiceClient(url, apiKey, apiSecret);

(async () => {
    try {
        const rooms = await roomService.listRooms();
        if (!rooms.length) {
            console.log('  No active LiveKit rooms found.');
            return;
        }

        console.log(`🔍  Found ${rooms.length} active room(s):\n`);
        rooms.forEach(r => console.log(`   • ${r.name}  (SID: ${r.sid}, participants: ${r.numParticipants})`));
        console.log('\n🗑️  Deleting all rooms...\n');

        await Promise.all(rooms.map(async (room) => {
            try {
                await roomService.deleteRoom(room.name);
                console.log(`     Deleted: ${room.name}`);
            } catch (err) {
                console.error(`   ❌  Failed to delete ${room.name}:`, err.message);
            }
        }));

        console.log('\n  All LiveKit sessions ended.\n');
    } catch (err) {
        console.error('❌  Error listing rooms:', err.message);
        process.exit(1);
    }
})();
