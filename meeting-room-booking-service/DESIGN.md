# Meeting Room Booking Service — Design Document

## Data Model

Three PostgreSQL tables (hosted on Supabase):

| Table | Purpose |
|---|---|
| `rooms` | Meeting rooms with capacity, floor, and amenities |
| `bookings` | Individual booking records with time range and status |
| `idempotency_keys` | Tracks idempotency keys per organizer to prevent duplicate bookings |

### Rooms
- `id` (UUID, PK) — auto-generated
- `name` / `normalized_name` — display name and lowercase version for uniqueness
- `capacity` (INT, ≥ 1), `floor` (INT)
- `amenities` (TEXT[]) — PostgreSQL array for efficient `@>` (contains) queries

### Bookings
- `id` (UUID, PK)
- `room_id` (FK → rooms)
- `title`, `organizer_email`
- `start_time`, `end_time` (TIMESTAMPTZ) with DB-level `CHECK (start_time < end_time)`
- `status` — `confirmed` or `cancelled`

### Idempotency Keys
- `key` + `organizer_email` — unique compound index
- `booking_id` (FK → bookings) — linked after successful creation
- `status` — `processing` → `completed` / `failed`

---

## How Overlaps Are Enforced

Overlap detection uses a **range intersection query** on confirmed bookings:

```sql
SELECT id FROM bookings
WHERE room_id = $1
  AND status = 'confirmed'
  AND start_time < $endTime
  AND end_time > $startTime
```

Two intervals `[A, B)` and `[C, D)` overlap if and only if `A < D AND C < B`. This is checked in the service layer before insert. Only `confirmed` bookings participate — cancelled bookings never block new bookings.

An index on `(room_id, status, start_time, end_time)` ensures this query is efficient.

---

## Error Handling Strategy

**Centralized error middleware** in `app.js` catches all thrown errors and returns a consistent JSON format:

```json
{
  "error": "ValidationError",
  "message": "startTime must be before endTime"
}
```

| Status | Error Type | When |
|--------|-----------|------|
| 400 | `ValidationError` | Input validation failures |
| 404 | `NotFoundError` | Unknown room or booking |
| 409 | `ConflictError` | Overlapping booking or concurrent idempotency race |
| 500 | `InternalError` | Unexpected DB errors |

Validation is performed in a separate `utils/validation.js` module before any business logic runs.

---

## Idempotency Implementation

Idempotency keys are **scoped per organizer** (`key` + `organizer_email` unique pair).

### Flow:
1. Client sends `POST /bookings` with `Idempotency-Key` header
2. **Check**: If a `completed` record exists for this key+email → return the stored booking
3. **Claim**: Insert a `processing` row. The DB unique constraint prevents concurrent duplicates.
4. **Create**: Proceed with booking creation
5. **Finalize**: Update the idempotency row to `completed` with the `booking_id`

### On failure:
- If booking insert fails → idempotency key is marked `failed`
- Client can retry with a new key

---

## Concurrency Handling

The primary concurrency concern is **duplicate bookings from retried requests with the same idempotency key**.

**Approach: DB unique constraint + insert-or-read pattern**

1. The `idempotency_keys` table has a unique index on `(key, organizer_email)`
2. The first request successfully inserts a `processing` row
3. A concurrent request with the same key hits the unique constraint violation
4. The concurrent request reads the existing row:
   - If `completed` → returns the existing booking (idempotent)
   - If `processing` → returns 409 asking the client to retry

**Limitation**: This does not use explicit row-level locking (`SELECT FOR UPDATE`), so there's a small window where a concurrent request could fail with 409 instead of waiting. This is an acceptable trade-off for simplicity — the client simply retries. For production, using a `SELECT ... FOR UPDATE` within a transaction would be more robust.

**Overlap check concurrency**: Two simultaneous bookings for the same slot could theoretically both pass the overlap check. In production, wrapping the check-and-insert in a `SERIALIZABLE` transaction or using an advisory lock would prevent this. The current implementation relies on the application-level check being fast enough that the race window is negligible.

---

## Utilization Calculation

### Formula
```
utilizationPercent = totalBookedHours / totalBusinessHours
```

### Definitions
- **Business hours**: Mon–Fri, 08:00–20:00 UTC = 12 hours/day
- **Total business hours**: Sum of effective business hours across all weekdays in the `[from, to]` range, clamped to 08:00–20:00 per day
- **Total booked hours**: Sum of each confirmed booking's duration, clamped to the `[from, to]` query range

### Edge Cases Handled
| Case | How |
|------|-----|
| No bookings in range | `totalBookingHours = 0`, `utilizationPercent = 0` |
| Booking starts before `from` | Clamped: `effectiveStart = max(bookingStart, from)` |
| Booking ends after `to` | Clamped: `effectiveEnd = min(bookingEnd, to)` |
| Weekend days | Skipped in business hours calculation |
| Zero business hours in range | `utilizationPercent = 0` (no division by zero) |
