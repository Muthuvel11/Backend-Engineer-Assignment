// tests/integration/bookings.test.js
import { jest } from "@jest/globals";

// ── In-memory store for mock ──────────────────────────────────
let mockRooms = [];
let mockBookings = [];
let mockIdempotencyKeys = [];
let idCounter = 1;

function buildChainable(table) {
    let filters = {};
    let selectOpts = {};
    let insertRows = null;
    let updateVals = null;
    let gtFilters = {};
    let ltFilters = {};
    let gteFilters = {};
    let lteFilters = {};
    let orderOpts = null;
    let rangeOpts = null;

    const getStore = () => {
        if (table === "rooms") return mockRooms;
        if (table === "bookings") return mockBookings;
        if (table === "idempotency_keys") return mockIdempotencyKeys;
        return [];
    };

    const applyFilters = (items) => {
        let result = [...items];
        for (const [col, val] of Object.entries(filters)) {
            result = result.filter(i => i[col] === val);
        }
        for (const [col, val] of Object.entries(gtFilters)) {
            result = result.filter(i => i[col] > val);
        }
        for (const [col, val] of Object.entries(ltFilters)) {
            result = result.filter(i => i[col] < val);
        }
        for (const [col, val] of Object.entries(gteFilters)) {
            result = result.filter(i => i[col] >= val);
        }
        for (const [col, val] of Object.entries(lteFilters)) {
            result = result.filter(i => i[col] <= val);
        }
        return result;
    };

    const builder = {
        select(cols, opts) { selectOpts = opts || {}; return builder; },
        insert(rows) { insertRows = rows; return builder; },
        update(vals) { updateVals = vals; return builder; },
        eq(col, val) { filters[col] = val; return builder; },
        gt(col, val) { gtFilters[col] = val; return builder; },
        lt(col, val) { ltFilters[col] = val; return builder; },
        gte(col, val) { gteFilters[col] = val; return builder; },
        lte(col, val) { lteFilters[col] = val; return builder; },
        order(col, opts) { orderOpts = { col, ...opts }; return builder; },
        range(from, to) { rangeOpts = { from, to }; return builder; },
        contains(col, val) { return builder; },

        single() {
            if (insertRows) {
                const row = { id: `uuid-${idCounter++}`, ...insertRows[0], created_at: new Date().toISOString() };
                getStore().push(row);
                return Promise.resolve({ data: row, error: null });
            }
            if (updateVals) {
                const store = getStore();
                const idx = store.findIndex(i => {
                    return Object.entries(filters).every(([k, v]) => i[k] === v);
                });
                if (idx >= 0) {
                    Object.assign(store[idx], updateVals);
                    return Promise.resolve({ data: store[idx], error: null });
                }
                return Promise.resolve({ data: null, error: { message: "Not found" } });
            }
            const items = applyFilters(getStore());
            return Promise.resolve({ data: items[0] || null, error: null });
        },

        maybeSingle() {
            if (insertRows) {
                // Check unique constraint for idempotency_keys
                if (table === "idempotency_keys") {
                    const key = insertRows[0].key;
                    const email = insertRows[0].organizer_email;
                    const existing = mockIdempotencyKeys.find(k => k.key === key && k.organizer_email === email);
                    if (existing) {
                        return Promise.resolve({ data: null, error: { message: "unique constraint", code: "23505" } });
                    }
                }
                const row = { id: `uuid-${idCounter++}`, ...insertRows[0], created_at: new Date().toISOString() };
                getStore().push(row);
                return Promise.resolve({ data: row, error: null });
            }
            const items = applyFilters(getStore());
            return Promise.resolve({ data: items[0] || null, error: null });
        },

        then(resolve) {
            if (insertRows) {
                // For idempotency_keys, check unique constraint
                if (table === "idempotency_keys") {
                    const key = insertRows[0].key;
                    const email = insertRows[0].organizer_email;
                    const existing = mockIdempotencyKeys.find(k => k.key === key && k.organizer_email === email);
                    if (existing) {
                        return resolve({ data: null, error: { message: "unique constraint", code: "23505" } });
                    }
                    const row = { id: `uuid-${idCounter++}`, ...insertRows[0], created_at: new Date().toISOString() };
                    mockIdempotencyKeys.push(row);
                    return resolve({ data: row, error: null });
                }
                const row = { id: `uuid-${idCounter++}`, ...insertRows[0], created_at: new Date().toISOString() };
                getStore().push(row);
                return resolve({ data: row, error: null });
            }
            if (updateVals) {
                const store = getStore();
                const idx = store.findIndex(i => {
                    return Object.entries(filters).every(([k, v]) => i[k] === v);
                });
                if (idx >= 0) {
                    Object.assign(store[idx], updateVals);
                    return resolve({ data: store[idx], error: null });
                }
                return resolve({ data: null, error: null });
            }
            let items = applyFilters(getStore());
            const count = selectOpts?.count === "exact" ? items.length : null;
            if (rangeOpts) {
                items = items.slice(rangeOpts.from, rangeOpts.to + 1);
            }
            return resolve({ data: items, error: null, count });
        }
    };
    return builder;
}

jest.unstable_mockModule("../../src/db/supabase.js", () => ({
    supabase: {
        from(table) { return buildChainable(table); }
    }
}));

const { default: app } = await import("../../src/app.js");
const { default: request } = await import("supertest");

beforeEach(() => {
    mockRooms = [{ id: "room-1", name: "Room A", normalized_name: "room a", capacity: 10, floor: 1, amenities: [] }];
    mockBookings = [];
    mockIdempotencyKeys = [];
    idCounter = 100;
});

// ── POST /bookings — Happy Path ──────────────────────────────
describe("POST /bookings — happy path", () => {
    test("201 — creates a booking successfully", async () => {
        const res = await request(app)
            .post("/bookings")
            .send({
                roomId: "room-1",
                title: "Standup",
                organizerEmail: "alice@test.com",
                startTime: "2025-06-02T09:00:00Z",  // Monday
                endTime: "2025-06-02T10:00:00Z"
            });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe("confirmed");
        expect(res.body.room_id).toBe("room-1");
    });
});

// ── POST /bookings — Validation Errors ───────────────────────
describe("POST /bookings — validation", () => {
    test("400 — startTime > endTime", async () => {
        const res = await request(app)
            .post("/bookings")
            .send({
                roomId: "room-1",
                title: "Standup",
                organizerEmail: "alice@test.com",
                startTime: "2025-06-02T10:00:00Z",
                endTime: "2025-06-02T09:00:00Z"
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("ValidationError");
    });

    test("400 — duration < 15 minutes", async () => {
        const res = await request(app)
            .post("/bookings")
            .send({
                roomId: "room-1",
                title: "Quick",
                organizerEmail: "alice@test.com",
                startTime: "2025-06-02T09:00:00Z",
                endTime: "2025-06-02T09:10:00Z"
            });

        expect(res.status).toBe(400);
    });

    test("400 — weekend booking", async () => {
        const res = await request(app)
            .post("/bookings")
            .send({
                roomId: "room-1",
                title: "Weekend",
                organizerEmail: "alice@test.com",
                startTime: "2025-06-07T09:00:00Z",  // Saturday
                endTime: "2025-06-07T10:00:00Z"
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Monday to Friday/i);
    });
});

// ── POST /bookings — 404 unknown room ────────────────────────
describe("POST /bookings — unknown room", () => {
    test("404 — room not found", async () => {
        const res = await request(app)
            .post("/bookings")
            .send({
                roomId: "nonexistent-room",
                title: "Meeting",
                organizerEmail: "alice@test.com",
                startTime: "2025-06-02T09:00:00Z",
                endTime: "2025-06-02T10:00:00Z"
            });

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });
});

// ── POST /bookings — 409 overlap ─────────────────────────────
describe("POST /bookings — overlap", () => {
    test("409 — overlapping confirmed booking", async () => {
        // Seed existing confirmed booking
        mockBookings.push({
            id: "booking-1",
            room_id: "room-1",
            title: "Existing",
            organizer_email: "bob@test.com",
            start_time: "2025-06-02T09:00:00Z",
            end_time: "2025-06-02T10:00:00Z",
            status: "confirmed"
        });

        const res = await request(app)
            .post("/bookings")
            .send({
                roomId: "room-1",
                title: "New overlapping",
                organizerEmail: "alice@test.com",
                startTime: "2025-06-02T09:30:00Z",
                endTime: "2025-06-02T10:30:00Z"
            });

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/overlap/i);
    });

    test("201 — cancelled booking does NOT block new booking", async () => {
        mockBookings.push({
            id: "booking-1",
            room_id: "room-1",
            title: "Cancelled",
            organizer_email: "bob@test.com",
            start_time: "2025-06-02T09:00:00Z",
            end_time: "2025-06-02T10:00:00Z",
            status: "cancelled"
        });

        const res = await request(app)
            .post("/bookings")
            .send({
                roomId: "room-1",
                title: "New in cancelled slot",
                organizerEmail: "alice@test.com",
                startTime: "2025-06-02T09:00:00Z",
                endTime: "2025-06-02T10:00:00Z"
            });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe("confirmed");
    });
});

// ── POST /bookings — Idempotency ─────────────────────────────
describe("POST /bookings — idempotency", () => {
    test("same key returns same booking, no duplicate", async () => {
        const payload = {
            roomId: "room-1",
            title: "Standup",
            organizerEmail: "alice@test.com",
            startTime: "2025-06-02T09:00:00Z",
            endTime: "2025-06-02T10:00:00Z"
        };

        const res1 = await request(app)
            .post("/bookings")
            .set("Idempotency-Key", "key-123")
            .send(payload);

        expect(res1.status).toBe(201);
        const bookingId = res1.body.id;

        // Second call with same key — should return same booking
        const res2 = await request(app)
            .post("/bookings")
            .set("Idempotency-Key", "key-123")
            .send(payload);

        expect(res2.status).toBe(201);
        expect(res2.body.id).toBe(bookingId);

        // Confirm no duplicate bookings were created
        const confirmedBookings = mockBookings.filter(b => b.status === "confirmed" && b.room_id === "room-1");
        expect(confirmedBookings).toHaveLength(1);
    });
});

// ── GET /bookings — Pagination & Filters ─────────────────────
describe("GET /bookings", () => {
    beforeEach(() => {
        mockBookings = [
            { id: "b1", room_id: "room-1", title: "A", start_time: "2025-06-02T09:00:00Z", end_time: "2025-06-02T10:00:00Z", status: "confirmed" },
            { id: "b2", room_id: "room-1", title: "B", start_time: "2025-06-02T11:00:00Z", end_time: "2025-06-02T12:00:00Z", status: "confirmed" },
            { id: "b3", room_id: "room-2", title: "C", start_time: "2025-06-02T09:00:00Z", end_time: "2025-06-02T10:00:00Z", status: "confirmed" },
        ];
    });

    test("200 — returns paginated structure", async () => {
        const res = await request(app).get("/bookings?limit=2&offset=0");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("items");
        expect(res.body).toHaveProperty("total");
        expect(res.body).toHaveProperty("limit");
        expect(res.body).toHaveProperty("offset");
    });

    test("200 — filters by roomId", async () => {
        const res = await request(app).get("/bookings?roomId=room-1");
        expect(res.status).toBe(200);
        expect(res.body.items.every(b => b.room_id === "room-1")).toBe(true);
    });
});

// ── POST /bookings/:id/cancel ────────────────────────────────
describe("POST /bookings/:id/cancel", () => {
    test("200 — cancels a booking > 1 hour before start", async () => {
        const futureDate = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // 3 hrs from now
        const futureEnd = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
        mockBookings.push({
            id: "cancel-1",
            room_id: "room-1",
            title: "To Cancel",
            start_time: futureDate,
            end_time: futureEnd,
            status: "confirmed"
        });

        const res = await request(app).post("/bookings/cancel-1/cancel");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("cancelled");
    });

    test("400 — cannot cancel < 1 hour before start", async () => {
        const soonDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();  // 30 min from now
        const soonEnd = new Date(Date.now() + 90 * 60 * 1000).toISOString();
        mockBookings.push({
            id: "cancel-2",
            room_id: "room-1",
            title: "Too Late",
            start_time: soonDate,
            end_time: soonEnd,
            status: "confirmed"
        });

        const res = await request(app).post("/bookings/cancel-2/cancel");
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/1 hour/i);
    });

    test("200 — cancelling already cancelled is a no-op", async () => {
        mockBookings.push({
            id: "cancel-3",
            room_id: "room-1",
            title: "Already Cancelled",
            start_time: "2025-12-01T09:00:00Z",
            end_time: "2025-12-01T10:00:00Z",
            status: "cancelled"
        });

        const res = await request(app).post("/bookings/cancel-3/cancel");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("cancelled");
    });

    test("404 — booking not found", async () => {
        const res = await request(app).post("/bookings/nonexistent/cancel");
        expect(res.status).toBe(404);
    });
});
