const PusherClient = require('pusher-js');
console.log('Type of PusherClient:', typeof PusherClient);
console.log('PusherClient:', PusherClient);
if (PusherClient.default) {
    console.log('Type of PusherClient.default:', typeof PusherClient.default);
}
