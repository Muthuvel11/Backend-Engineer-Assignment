import { supabase } from "../db/supabase.js";

export async function createRoom(data) {
    const normalized = data.name.toLowerCase().trim();

    const { data: existing } = await supabase
        .from("rooms")
        .select("id")
        .eq("normalized_name", normalized)
        .maybeSingle();

    if (existing) {
        throw { status: 400, message: "A room with this name already exists (names are case-insensitive)" };
    }

    const { data: room, error } = await supabase
        .from("rooms")
        .insert([{
            name: data.name,
            normalized_name: normalized,
            capacity: data.capacity,
            floor: data.floor,
            amenities: data.amenities
        }])
        .select()
        .single();

    if (error) throw { status: 500, message: error.message };

    return room;
}

export async function getRooms(minCapacity, amenity) {
    let query = supabase.from("rooms").select("*");

    if (minCapacity !== undefined) {
        const cap = parseInt(minCapacity, 10);
        if (!isNaN(cap)) {
            query = query.gte("capacity", cap);
        }
    }

    if (amenity) {
        query = query.contains("amenities", [amenity]);
    }

    const { data, error } = await query;
    if (error) throw { status: 500, message: error.message };

    return data || [];
}