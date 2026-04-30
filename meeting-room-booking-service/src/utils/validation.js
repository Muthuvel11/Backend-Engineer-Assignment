export function validateCreateRoom(body) {
    const { name, capacity, floor, amenities } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
        throw { status: 400, message: "name is required and must be a non-empty string" };
    }

    if (!Number.isInteger(capacity) || capacity < 1) {
        throw { status: 400, message: "capacity must be a positive integer >= 1" };
    }

    if (floor === undefined || floor === null || !Number.isInteger(floor)) {
        throw { status: 400, message: "floor is required and must be an integer" };
    }

    if (!Array.isArray(amenities) || amenities.some(a => typeof a !== "string")) {
        throw { status: 400, message: "amenities must be an array of strings" };
    }
}

export function validateCreateBooking(body) {
    const { roomId, title, organizerEmail, startTime, endTime } = body;

    if (!roomId) {
        throw { status: 400, message: "roomId is required" };
    }

    if (!title || typeof title !== "string" || !title.trim()) {
        throw { status: 400, message: "title is required" };
    }

    if (!organizerEmail || typeof organizerEmail !== "string") {
        throw { status: 400, message: "organizerEmail is required" };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(organizerEmail)) {
        throw { status: 400, message: "organizerEmail must be a valid email address" };
    }

    if (!isValidDate(startTime) || !isValidDate(endTime)) {
        throw { status: 400, message: "startTime and endTime must be valid ISO-8601 dates" };
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw { status: 400, message: "startTime and endTime must be valid ISO-8601 dates" };
    }

    if (start >= end) {
        throw { status: 400, message: "startTime must be before endTime" };
    }

    const durationMinutes = (end - start) / (1000 * 60);
    if (durationMinutes < 15 || durationMinutes > 240) {
        throw { status: 400, message: "Booking duration must be between 15 minutes and 4 hours" };
    }

    const startDay = start.getUTCDay();
    const endDay = end.getUTCDay();

    if (startDay === 0 || startDay === 6 || endDay === 0 || endDay === 6) {
        throw { status: 400, message: "Bookings are only allowed Monday to Friday" };
    }

    const startHour = start.getUTCHours();
    const endHour = end.getUTCHours();
    const endMin = end.getUTCMinutes();

    if (startHour < 8) {
        throw { status: 400, message: "Bookings are only allowed between 08:00 and 20:00" };
    }

    if (endHour > 20 || (endHour === 20 && endMin > 0)) {
        throw { status: 400, message: "Bookings are only allowed between 08:00 and 20:00" };
    }
}

export function isValidDate(value) {
    const date = new Date(value);
    return value && !Number.isNaN(date.getTime());
}