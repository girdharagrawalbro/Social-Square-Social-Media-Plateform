# Architecture

## High Level Architecture
Social Square utilizes a distributed, event-driven architecture designed for real-time interactions and high availability. The system is split into multiple microservices and background workers communicating via NATS and BullMQ.

## Frontend Architecture
The frontend is built with React, leveraging Zustand for ephemeral client state (UI state, drafts) and TanStack Query for server state (caching, background sync). It implements optimistic UI updates and uses the Broadcast Channel API to synchronize state across multiple tabs. IndexedDB provides robust offline capabilities.

## Backend Architecture
The backend consists of scalable Node.js/Express instances. It follows a Service-Oriented Architecture, utilizing a Middleware Pipeline, Repository Pattern for database operations, and an Event-Driven model for asynchronous processing.

## Architecture Diagrams

### Socket Flow
```mermaid
sequenceDiagram
    participant Client
    participant LoadBalancer
    participant NodeInstance
    participant RedisAdapter
    
    Client->>LoadBalancer: Connect
    LoadBalancer->>NodeInstance: Route Traffic
    NodeInstance->>RedisAdapter: Register Socket (User ID)
    NodeInstance-->>Client: Connection Established
    Client->>NodeInstance: Emit Event (e.g. typing)
    NodeInstance->>RedisAdapter: Broadcast to Room
    RedisAdapter->>NodeInstance: Distribute to other instances
    NodeInstance-->>Client: Receive Event
```

### Upload Flow
```mermaid
sequenceDiagram
    participant User
    participant ReactClient
    participant CryptoService
    participant NodeAPI
    participant Cloudinary
    participant MongoDB
    
    User->>ReactClient: Select Media
    ReactClient->>CryptoService: Encrypt (AES-GCM)
    CryptoService-->>ReactClient: Encrypted Blob
    ReactClient->>NodeAPI: Upload request
    NodeAPI->>Cloudinary: Forward Encrypted Blob
    Cloudinary-->>NodeAPI: URL & Metadata
    NodeAPI->>MongoDB: Save Post Record
    NodeAPI-->>ReactClient: Success
```

### Feed Loading Flow
```mermaid
sequenceDiagram
    participant Client
    participant IndexedDB
    participant NodeAPI
    participant RedisCache
    participant MongoDB
    
    Client->>IndexedDB: Load local feed
    IndexedDB-->>Client: Display cached posts
    Client->>NodeAPI: Fetch new feed (cursor)
    NodeAPI->>RedisCache: Check cache
    alt Cache Miss
        NodeAPI->>MongoDB: Query recent posts
        MongoDB-->>NodeAPI: Posts Data
        NodeAPI->>RedisCache: Set cache
    end
    NodeAPI-->>Client: New posts
    Client->>IndexedDB: Update local cache
```

### Media Processing Flow
```mermaid
sequenceDiagram
    participant UploadAPI
    participant BullMQ
    participant WorkerService
    participant Storage
    
    UploadAPI->>BullMQ: Enqueue media job
    BullMQ->>WorkerService: Process (compress/resize)
    WorkerService->>Storage: Save processed media
    WorkerService->>BullMQ: Job complete
```
