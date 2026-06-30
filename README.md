# TicketGo - High-Concurrency Ticket Booking Engine

A scalable, high-concurrency ticket reservation system built with Node.js and Express. This platform is designed to handle "flash crowds" and massive traffic spikes safely using an Event-Driven, Hybrid-Inventory architecture, preventing database locking and race conditions.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose) with compound unique indexing & ACID transactions
- **Caching & Locking:** Redis (ioredis), Redlock
- **Message Queue:** BullMQ (Background Workers)
- **Real-time:** Socket.io (WebSocket seat sync)
- **Security:** JWT Authentication, Helmet, Custom Rate Limiter (Token Bucket), CORS

## The Hybrid Inventory Architecture

To balance performance and user experience, the system dynamically shifts its booking logic based on venue size:

### 1. Reserved Seating (< 500 Capacity)
- **Approach:** Discrete, locational seat records.
- **Concurrency Control:** Utilizes Redis Distributed Locks (Redlock) to guarantee that a specific seat (e.g., Row A, Seat 12) is never double-booked.

### 2. Zoned Capacity (500+ Capacity)
- **Approach:** Designed for stadiums and festivals. Drops discrete seat tracking in favor of high-performance Section-Level Inventory Counters.
- **Concurrency Control:** Utilizes MongoDB atomic `$inc` operators and Redis TTL holds to manage thousands of concurrent checkouts seamlessly.

## Core Features

- **Role-Based Access Control (RBAC):** `CUSTOMER`, `ORGANIZER`, `ADMIN`.
- **Idempotency & Bot Protection APIs:** Ensuring identical requests are handled safely and malicious bot activity is mitigated.
- **Real-Time Updates:** Broadcasting seat availability to active users using WebSockets (`Socket.io`).
- **Asynchronous Processing:** Asynchronous ticket PDF generation and email delivery handled via background workers using `BullMQ`.

## Project Initialization Status
The fundamental Node.js environment has been initialized and the core dependencies have been installed:
- `express`, `mongoose`, `ioredis`, `bullmq`, `socket.io`, `jsonwebtoken`, `helmet`, `cors`, `dotenv`, `redlock`
