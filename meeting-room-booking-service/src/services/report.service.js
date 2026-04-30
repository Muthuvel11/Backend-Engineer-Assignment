import { supabase } from "../db/supabase.js";
import { isValidDate } from "../utils/validation.js";

function calcBusinessHours(from, to) {
    const rangeStart = new Date(from);
    const rangeEnd = new Date(to);

    let totalHours = 0;
    const cursor = new Date(rangeStart);

    while (cursor < rangeEnd) {
        const day = cursor.getUTCDay();
        if (day !== 0 && day !== 6) {
            const dayStart = new Date(cursor);
            dayStart.setUTCHours(8, 0, 0, 0);

            const dayEnd = new Date(cursor);
            dayEnd.setUTCHours(20, 0, 0, 0);

            const effectiveStart = new Date(Math.max(dayStart, rangeStart));
            const effectiveEnd = new Date(Math.min(dayEnd, rangeEnd));

            if (effectiveStart < effectiveEnd) {
                totalHours += (effectiveEnd - effectiveStart) / (1000 * 60 * 60);
            }
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        cursor.setUTCHours(0, 0, 0, 0);
    }

    return totalHours;
}

export async function getUtilization(from, to) {
    if (!isValidDate(from) || !isValidDate(to)) {
        throw { status: 400, message: "'from' and 'to' must be valid ISO-8601 dates" };
    }

    const rangeStart = new Date(from);
    const rangeEnd = new Date(to);

    const { data: rooms, error: roomsError } = await supabase.from("rooms").select("*");
    if (roomsError) throw { status: 500, message: roomsError.message };

    const businessHours = calcBusinessHours(rangeStart, rangeEnd);
    const results = [];

    for (const room of rooms) {
        const { data: bookings, error: bookingsError } = await supabase
            .from("bookings")
            .select("start_time, end_time")
            .eq("room_id", room.id)
            .eq("status", "confirmed")
            .lt("start_time", rangeEnd.toISOString())
            .gt("end_time", rangeStart.toISOString());

        if (bookingsError) throw { status: 500, message: bookingsError.message };

        let totalBookingHours = 0;

        for (const b of bookings) {
            const bStart = new Date(Math.max(new Date(b.start_time), rangeStart));
            const bEnd = new Date(Math.min(new Date(b.end_time), rangeEnd));

            if (bStart < bEnd) {
                totalBookingHours += (bEnd - bStart) / (1000 * 60 * 60);
            }
        }

        const utilizationPercent =
            businessHours > 0 ? parseFloat((totalBookingHours / businessHours).toFixed(4)) : 0;

        results.push({
            roomId: room.id,
            roomName: room.name,
            totalBookingHours: parseFloat(totalBookingHours.toFixed(2)),
            utilizationPercent
        });
    }

    return results;
}