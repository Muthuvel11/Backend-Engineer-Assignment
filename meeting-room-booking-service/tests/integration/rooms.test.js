// tests/integration/rooms.test.js
import { jest } from "@jest/globals";

// ── Mock Supabase before importing app ─────────────────────────
let mockRooms = [];
let insertError = null;

const chainable = () => {
    const builder = {
        select() { return builder; },
        insert(rows) {
            if (insertError) return { ...builder, _earlyError: insertError };
            const room = { id: "uuid-1", ...rows[0], created_at: new Date().toISOString() };
            mockRooms.push(room);
            builder._inserted = room;
            return builder;
        },
        eq(col, val) {
            builder._filters = builder._filters || {};
            builder._filters[col] = val;
            return builder;
        },
        gte(col, val) {
            builder._gte = { col, val };
            return builder;
        },
        contains(col, arr) {
            builder._contains = { col, arr };
            return builder;
        },
        single() {
            if (builder._earlyError) return Promise.resolve({ data: null, error: builder._earlyError });
            if (builder._inserted) return Promise.resolve({ data: builder._inserted, error: null });
            const match = mockRooms.find(r => r.normalized_name === builder._filters?.normalized_name);
            return Promise.resolve({ data: match || null, error: null });
        },
        maybeSingle() {
            return this.single();
        },
        then(resolve) {
            let filtered = [...mockRooms];
            if (builder._gte) {
                filtered = filtered.filter(r => r[builder._gte.col] >= builder._gte.val);
            }
            if (builder._contains) {
                const arr = builder._contains.arr;
                filtered = filtered.filter(r =>
                    arr.every(a => r[builder._contains.col]?.includes(a))
                );
            }
            return resolve({ data: filtered, error: null });
        }
    };
    return builder;
};

jest.unstable_mockModule("../../src/db/supabase.js", () => ({
    supabase: {
        from() { return chainable(); }
    }
}));

const { default: app } = await import("../../src/app.js");
const { default: request } = await import("supertest");

describe("POST /rooms", () => {
    beforeEach(() => { mockRooms = []; insertError = null; });

    test("201 — creates a room successfully", async () => {
        const res = await request(app)
            .post("/rooms")
            .send({ name: "Board Room", capacity: 10, floor: 2, amenities: ["projector"] });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body.name).toBe("Board Room");
    });

    test("400 — rejects duplicate name (case-insensitive)", async () => {
        // Seed a room
        mockRooms.push({ id: "uuid-1", name: "Board Room", normalized_name: "board room", capacity: 10, floor: 2, amenities: [] });

        const res = await request(app)
            .post("/rooms")
            .send({ name: "board room", capacity: 10, floor: 2, amenities: [] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already exists/i);
    });

    test("400 — rejects missing name", async () => {
        const res = await request(app)
            .post("/rooms")
            .send({ capacity: 10, floor: 2, amenities: [] });

        expect(res.status).toBe(400);
    });

    test("400 — rejects capacity < 1", async () => {
        const res = await request(app)
            .post("/rooms")
            .send({ name: "Room Z", capacity: 0, floor: 1, amenities: [] });

        expect(res.status).toBe(400);
    });
});

describe("GET /rooms", () => {
    beforeEach(() => {
        mockRooms = [
            { id: "r1", name: "Small", normalized_name: "small", capacity: 4, floor: 1, amenities: ["whiteboard"] },
            { id: "r2", name: "Large", normalized_name: "large", capacity: 20, floor: 3, amenities: ["projector", "whiteboard"] },
        ];
    });

    test("200 — returns all rooms when no filters", async () => {
        const res = await request(app).get("/rooms");
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
    });

    test("200 — filters by minCapacity", async () => {
        const res = await request(app).get("/rooms?minCapacity=10");
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].name).toBe("Large");
    });

    test("200 — filters by amenity", async () => {
        const res = await request(app).get("/rooms?amenity=projector");
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].name).toBe("Large");
    });
});
