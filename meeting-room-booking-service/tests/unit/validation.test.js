// tests/unit/validation.test.js
import { validateCreateRoom, validateCreateBooking } from "../../src/utils/validation.js";

describe("validateCreateRoom", () => {
    const validRoom = {
        name: "Room A",
        capacity: 10,
        floor: 2,
        amenities: ["projector", "whiteboard"]
    };

    test("accepts a valid room", () => {
        expect(() => validateCreateRoom(validRoom)).not.toThrow();
    });

    test("rejects missing name", () => {
        expect(() => validateCreateRoom({ ...validRoom, name: "" }))
            .toThrow(expect.objectContaining({ status: 400 }));
    });

    test("rejects non-string name", () => {
        expect(() => validateCreateRoom({ ...validRoom, name: 123 }))
            .toThrow(expect.objectContaining({ status: 400 }));
    });

    test("rejects capacity < 1", () => {
        expect(() => validateCreateRoom({ ...validRoom, capacity: 0 }))
            .toThrow(expect.objectContaining({ status: 400 }));
    });

    test("rejects non-integer capacity", () => {
        expect(() => validateCreateRoom({ ...validRoom, capacity: 2.5 }))
            .toThrow(expect.objectContaining({ status: 400 }));
    });

    test("rejects missing floor", () => {
        expect(() => validateCreateRoom({ ...validRoom, floor: undefined }))
            .toThrow(expect.objectContaining({ status: 400 }));
    });

    test("rejects non-array amenities", () => {
        expect(() => validateCreateRoom({ ...validRoom, amenities: "projector" }))
            .toThrow(expect.objectContaining({ status: 400 }));
    });

    test("rejects amenities with non-string elements", () => {
        expect(() => validateCreateRoom({ ...validRoom, amenities: [123] }))
            .toThrow(expect.objectContaining({ status: 400 }));
    });
});

describe("validateCreateBooking", () => {
    // Use a known Monday in UTC: 2025-06-02 is Monday
    const validBooking = {
        roomId: "room-1",
        title: "Standup",
        organizerEmail: "test@example.com",
        startTime: "2025-06-02T09:00:00Z",
        endTime: "2025-06-02T10:00:00Z"
    };

    test("accepts a valid booking", () => {
        expect(() => validateCreateBooking(validBooking)).not.toThrow();
    });

    // ── Missing fields ──────────────────────────────────────
    test("rejects missing roomId", () => {
        expect(() => validateCreateBooking({ ...validBooking, roomId: "" }))
            .toThrow(expect.objectContaining({ status: 400 }));
    });

    test("rejects missing title", () => {
        expect(() => validateCreateBooking({ ...validBooking, title: "" }))
            .toThrow(expect.objectContaining({ status: 400 }));
    });

    test("rejects missing organizerEmail", () => {
        expect(() => validateCreateBooking({ ...validBooking, organizerEmail: "" }))
            .toThrow(expect.objectContaining({ status: 400 }));
    });

    test("rejects invalid email format", () => {
        expect(() => validateCreateBooking({ ...validBooking, organizerEmail: "not-email" }))
            .toThrow(expect.objectContaining({ status: 400 }));
    });

    test("rejects missing startTime", () => {
        expect(() => validateCreateBooking({ ...validBooking, startTime: "" }))
            .toThrow(expect.objectContaining({ status: 400 }));
    });

    // ── Time rules ──────────────────────────────────────────
    test("rejects startTime >= endTime", () => {
        expect(() => validateCreateBooking({
            ...validBooking,
            startTime: "2025-06-02T10:00:00Z",
            endTime: "2025-06-02T09:00:00Z"
        })).toThrow(expect.objectContaining({ status: 400, message: expect.stringContaining("before") }));
    });

    test("rejects duration < 15 minutes", () => {
        expect(() => validateCreateBooking({
            ...validBooking,
            startTime: "2025-06-02T09:00:00Z",
            endTime: "2025-06-02T09:10:00Z"
        })).toThrow(expect.objectContaining({ status: 400, message: expect.stringContaining("15 minutes") }));
    });

    test("rejects duration > 4 hours", () => {
        expect(() => validateCreateBooking({
            ...validBooking,
            startTime: "2025-06-02T08:00:00Z",
            endTime: "2025-06-02T12:30:00Z"
        })).toThrow(expect.objectContaining({ status: 400, message: expect.stringContaining("4 hours") }));
    });

    test("accepts exactly 15 minutes", () => {
        expect(() => validateCreateBooking({
            ...validBooking,
            startTime: "2025-06-02T09:00:00Z",
            endTime: "2025-06-02T09:15:00Z"
        })).not.toThrow();
    });

    test("accepts exactly 4 hours", () => {
        expect(() => validateCreateBooking({
            ...validBooking,
            startTime: "2025-06-02T09:00:00Z",
            endTime: "2025-06-02T13:00:00Z"
        })).not.toThrow();
    });

    // ── Weekend check ───────────────────────────────────────
    test("rejects Saturday booking", () => {
        // 2025-06-07 is Saturday
        expect(() => validateCreateBooking({
            ...validBooking,
            startTime: "2025-06-07T09:00:00Z",
            endTime: "2025-06-07T10:00:00Z"
        })).toThrow(expect.objectContaining({ status: 400, message: expect.stringContaining("Monday to Friday") }));
    });

    test("rejects Sunday booking", () => {
        // 2025-06-08 is Sunday
        expect(() => validateCreateBooking({
            ...validBooking,
            startTime: "2025-06-08T09:00:00Z",
            endTime: "2025-06-08T10:00:00Z"
        })).toThrow(expect.objectContaining({ status: 400, message: expect.stringContaining("Monday to Friday") }));
    });

    test("rejects booking ending on Saturday (cross-day)", () => {
        // 2025-06-06 is Friday
        expect(() => validateCreateBooking({
            ...validBooking,
            startTime: "2025-06-06T19:00:00Z",
            endTime: "2025-06-07T19:30:00Z"   // Saturday
        })).toThrow(expect.objectContaining({ status: 400 }));
    });

    // ── Business hours ──────────────────────────────────────
    test("rejects booking before 08:00", () => {
        expect(() => validateCreateBooking({
            ...validBooking,
            startTime: "2025-06-02T07:00:00Z",
            endTime: "2025-06-02T08:00:00Z"
        })).toThrow(expect.objectContaining({ status: 400, message: expect.stringContaining("08:00") }));
    });

    test("rejects booking ending after 20:00", () => {
        expect(() => validateCreateBooking({
            ...validBooking,
            startTime: "2025-06-02T18:00:00Z",
            endTime: "2025-06-02T20:30:00Z"
        })).toThrow(expect.objectContaining({ status: 400, message: expect.stringContaining("20:00") }));
    });

    test("accepts booking ending exactly at 20:00", () => {
        expect(() => validateCreateBooking({
            ...validBooking,
            startTime: "2025-06-02T16:00:00Z",
            endTime: "2025-06-02T20:00:00Z"
        })).not.toThrow();
    });

    test("accepts booking starting exactly at 08:00", () => {
        expect(() => validateCreateBooking({
            ...validBooking,
            startTime: "2025-06-02T08:00:00Z",
            endTime: "2025-06-02T09:00:00Z"
        })).not.toThrow();
    });
});
