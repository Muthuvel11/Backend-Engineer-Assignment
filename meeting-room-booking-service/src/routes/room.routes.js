
import express from "express";
import { createRoom, getRooms } from "../services/room.service.js";
import { validateCreateRoom } from "../utils/validation.js";

const router = express.Router();


router.post("/", async (req, res, next) => {
    try {
        validateCreateRoom(req.body);
        const room = await createRoom(req.body);
        res.status(201).json(room);
    } catch (err) {
        next(err);
    }
});


router.get("/", async (req, res, next) => {
    try {
        const { minCapacity, amenity } = req.query;
        const rooms = await getRooms(minCapacity, amenity);
        res.json(rooms);
    } catch (err) {
        next(err);
    }
});

export default router;