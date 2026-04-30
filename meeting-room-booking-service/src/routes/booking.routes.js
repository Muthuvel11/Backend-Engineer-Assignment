import express from "express";
import {
    createBooking,
    getBookings,
    cancelBooking
} from "../services/booking.service.js";

import { validateCreateBooking } from "../utils/validation.js";

const router = express.Router();

router.post("/", async (req, res, next) => {
    try {
        validateCreateBooking(req.body);

        const key = req.headers["idempotency-key"];

        const booking = await createBooking(req.body, key);

        res.status(201).json(booking);
    } catch (err) {
        next(err);
    }
});

router.get("/", async (req, res, next) => {
    try {
        const { roomId, from, to, limit = 10, offset = 0 } = req.query;

        const bookings = await getBookings(roomId, from, to, limit, offset);

        res.json(bookings);
    } catch (err) {
        next(err);
    }
});

router.post("/:id/cancel", async (req, res, next) => {
    try {
        const result = await cancelBooking(req.params.id);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

export default router;