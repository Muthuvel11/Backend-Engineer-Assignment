# Meeting Room Booking Service

REST API for managing meeting room bookings with idempotency, cancellation, and utilization reporting.

## Tech Stack

- **Runtime**: Node.js (ESM)
- **Framework**: Express.js
- **Database**: PostgreSQL via Supabase
- **Testing**: Jest + Supertest

## Setup

1. **Clone and install**:
   ```bash
   npm install
   ```

2. **Environment**: Create a `.env` file:
   ```env
   SUPABASE_URL=your-supabase-url
   SUPABASE_KEY=your-supabase-anon-key
   PORT=3000
   ```

3. **Database**: Run `src/db/schema.sql` in your Supabase SQL editor.

4. **Start**:
   ```bash
   npm start        # production
   npm run dev      # development (auto-reload)
   ```

## Run Tests

```bash
npm test
```

Tests use a mocked Supabase client and run offline — no database connection required.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/rooms` | Create a room |
| GET | `/rooms` | List rooms (filter: `minCapacity`, `amenity`) |
| POST | `/bookings` | Create a booking (supports `Idempotency-Key` header) |
| GET | `/bookings` | List bookings (filter: `roomId`, `from`, `to`; pagination: `limit`, `offset`) |
| POST | `/bookings/:id/cancel` | Cancel a booking |
| GET | `/reports/room-utilization` | Room utilization report (`from`, `to` required) |

See [DESIGN.md](DESIGN.md) for architecture details.
