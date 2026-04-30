// tests/integration/reports.test.js
import { jest } from "@jest/globals";

// ── In-memory stores ──────────────────────────────────────────
let mockRooms = [];
let mockBookings = [];

function buildChainable(table) {
    let filters = {};
    let gtFilters = {};
    let ltFilters = {};

    const getStore = () => table === "rooms" ? mockRooms : mockBookings;

    const builder = {
        select(cols, opts) { return builder; },
        eq(col, val) { filters[col] = val; return builder; },
        gt(col, val) { gtFilters[col] = val; return builder; },
        lt(col, val) { ltFilters[col] = val; return builder; },

        then(resolve) {
            let items = [...getStore()];
            for (const [col, val] of Object.entries(filters)) {
                items = items.filter(i => i[col] === val);
            }
            for (const [col, val] of Object.entries(gtFilters)) {
                items = items.filter(i => i[col] > val);
            }
            for (const [col, val] of Object.entries(ltFilters)) {
                items = items.filter(i => i[col] < val);
            }
            return resolve({ data: items, error: null });
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
    mockRooms = [
        { id: "r1", name: "Room A", capacity: 10, floor: 1, amenities: [] },
        { id: "r2", name: "Room B", capacity: 6, floor: 2, amenities: [] },
    ];
    mockBookings = [];
});

describe("GET /reports/room-utilization", () => {
    test("400 — missing from/to", async () => {
        const res = await request(app).get("/reports/room-utilization");
        expect(res.status).toBe(400);
    });

    test("200 — returns utilization for each room (no bookings)", async () => {
        // 2025-06-02 (Mon) to 2025-06-06 (Fri) = 5 business days = 60 hours
        const res = await request(app).get(
            "/reports/room-utilization?from=2025-06-02T00:00:00Z&to=2025-06-06T23:59:59Z"
        );

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body[0].totalBookingHours).toBe(0);
        expect(res.body[0].utilizationPercent).toBe(0);
    });

    test("200 — correct utilization with bookings", async () => {
        // 1 booking = 2 hours in Room A
        mockBookings.push({
            id: "b1",
            room_id: "r1",
            start_time: "2025-06-02T09:00:00Z",
            end_time: "2025-06-02T11:00:00Z",
            status: "confirmed"
        });

        // Mon only: 2025-06-02T08:00Z – 2025-06-02T20:00Z = 12 business hours
        const res = await request(app).get(
            "/reports/room-utilization?from=2025-06-02T08:00:00Z&to=2025-06-02T20:00:00Z"
        );

        expect(res.status).toBe(200);
        const roomA = res.body.find(r => r.roomId === "r1");
        expect(roomA.totalBookingHours).toBe(2);
        // 2 / 12 ≈ 0.1667
        expect(roomA.utilizationPercent).toBeCloseTo(0.1667, 3);
    });

    test("200 — partial overlap: booking starts before range", async () => {
        // Booking: 07:00–10:00, but range starts at 08:00 → effective = 08:00–10:00 = 2 hrs
        mockBookings.push({
            id: "b2",
            room_id: "r1",
            start_time: "2025-06-02T07:00:00Z",
            end_time: "2025-06-02T10:00:00Z",
            status: "confirmed"
        });

        const res = await request(app).get(
            "/reports/room-utilization?from=2025-06-02T08:00:00Z&to=2025-06-02T20:00:00Z"
        );

        expect(res.status).toBe(200);
        const roomA = res.body.find(r => r.roomId === "r1");
        expect(roomA.totalBookingHours).toBe(2);
    });

    test("200 — partial overlap: booking ends after range", async () => {
        // Booking: 18:00–22:00, but range ends at 20:00 → effective = 18:00–20:00 = 2 hrs
        mockBookings.push({
            id: "b3",
            room_id: "r1",
            start_time: "2025-06-02T18:00:00Z",
            end_time: "2025-06-02T22:00:00Z",
            status: "confirmed"
        });

        const res = await request(app).get(
            "/reports/room-utilization?from=2025-06-02T08:00:00Z&to=2025-06-02T20:00:00Z"
        );

        expect(res.status).toBe(200);
        const roomA = res.body.find(r => r.roomId === "r1");
        expect(roomA.totalBookingHours).toBe(2);
    });

    test("200 — cancelled bookings are excluded", async () => {
        mockBookings.push({
            id: "b4",
            room_id: "r1",
            start_time: "2025-06-02T09:00:00Z",
            end_time: "2025-06-02T11:00:00Z",
            status: "cancelled"
        });

        const res = await request(app).get(
            "/reports/room-utilization?from=2025-06-02T08:00:00Z&to=2025-06-02T20:00:00Z"
        );

        expect(res.status).toBe(200);
        const roomA = res.body.find(r => r.roomId === "r1");
        expect(roomA.totalBookingHours).toBe(0);
    });
});
