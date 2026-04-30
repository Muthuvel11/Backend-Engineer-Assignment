import { supabase } from "../db/supabase.js";
import { isValidDate } from "../utils/validation.js";

export async function createBooking(dto, idempotencyKey) {
    const { roomId, title, organizerEmail, startTime, endTime } = dto;

    if (idempotencyKey) {
        const { data: existing } = await supabase
            .from("idempotency_keys")
            .select("booking_id, status")
            .eq("key", idempotencyKey)
            .eq("organizer_email", organizerEmail)
            .maybeSingle();

        if (existing?.status === "completed" && existing.booking_id) {
            const { data: booking } = await supabase
                .from("bookings")
                .select("*")
                .eq("id", existing.booking_id)
                .single();
            return booking;
        }

        const { error: idempotencyInsertError } = await supabase
            .from("idempotency_keys")
            .insert([{
                key: idempotencyKey,
                organizer_email: organizerEmail,
                status: "processing"
            }]);

        if (idempotencyInsertError) {
            const { data: raceRow } = await supabase
                .from("idempotency_keys")
                .select("booking_id, status")
                .eq("key", idempotencyKey)
                .eq("organizer_email", organizerEmail)
                .maybeSingle();

            if (raceRow?.status === "completed" && raceRow.booking_id) {
                const { data: booking } = await supabase
                    .from("bookings")
                    .select("*")
                    .eq("id", raceRow.booking_id)
                    .single();
                return booking;
            }

            throw { status: 409, error: "ConflictError", message: "Concurrent booking request in progress. Please retry." };
        }
    }

    const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

    if (!room) throw { status: 404, message: "Room not found" };

    const start = new Date(startTime);
    const end = new Date(endTime);

    const { data: overlap, error: overlapError } = await supabase
        .from("bookings")
        .select("id")
        .eq("room_id", roomId)
        .eq("status", "confirmed")
        .lt("start_time", end.toISOString())
        .gt("end_time", start.toISOString());

    if (overlapError) throw { status: 500, message: overlapError.message };
    if (overlap.length > 0)
        throw { status: 409, error: "ConflictError", message: "This time slot overlaps with an existing confirmed booking" };

    const { data: booking, error: insertError } = await supabase
        .from("bookings")
        .insert([{
            room_id: roomId,
            title,
            organizer_email: organizerEmail,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: "confirmed"
        }])
        .select()
        .single();

    if (insertError) {
        if (idempotencyKey) {
            await supabase
                .from("idempotency_keys")
                .update({ status: "failed" })
                .eq("key", idempotencyKey)
                .eq("organizer_email", organizerEmail);
        }
        throw { status: 500, message: insertError.message };
    }

    if (idempotencyKey) {
        await supabase
            .from("idempotency_keys")
            .update({ booking_id: booking.id, status: "completed" })
            .eq("key", idempotencyKey)
            .eq("organizer_email", organizerEmail);
    }

    return booking;
}

export async function getBookings(roomId, from, to, limit = 10, offset = 0) {
    const lim = Math.min(parseInt(limit, 10) || 10, 100);
    const off = parseInt(offset, 10) || 0;

    let query = supabase
        .from("bookings")
        .select("*", { count: "exact" })
        .order("start_time", { ascending: true })
        .range(off, off + lim - 1);

    if (roomId) {
        query = query.eq("room_id", roomId);
    }

    if (from) {
        if (!isValidDate(from)) throw { status: 400, message: "'from' must be a valid ISO-8601 date" };
        query = query.gte("start_time", new Date(from).toISOString());
    }

    if (to) {
        if (!isValidDate(to)) throw { status: 400, message: "'to' must be a valid ISO-8601 date" };
        query = query.lte("end_time", new Date(to).toISOString());
    }

    const { data, count, error } = await query;
    if (error) throw { status: 500, message: error.message };

    return {
        items: data || [],
        total: count || 0,
        limit: lim,
        offset: off
    };
}

export async function cancelBooking(id) {
    const { data: booking } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (!booking) throw { status: 404, message: "Booking not found" };

    if (booking.status === "cancelled") return booking;

    const minutesUntilStart = (new Date(booking.start_time) - new Date()) / (1000 * 60);

    if (minutesUntilStart < 60) {
        throw {
            status: 400,
            message: "Cancellation is only allowed more than 1 hour before the booking start time"
        };
    }

    const { data, error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", id)
        .select()
        .single();

    if (error) throw { status: 500, message: error.message };

    return data;
}