const EventEmitter = require('events');

// Create a centralized event emitter for internal backend events
const eventBus = new EventEmitter();

// Allow up to 100 listeners to avoid memory leak warnings in complex event flows
eventBus.setMaxListeners(100);

module.exports = eventBus;
