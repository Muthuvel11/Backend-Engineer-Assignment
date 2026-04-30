import express from "express";
import { getUtilization } from "../services/report.service.js";

const router = express.Router();

router.get("/room-utilization", async (req, res, next) => {
    try {
        const { from, to } = req.query;

        if (!from || !to) {
            throw { status: 400, message: "from and to required" };
        }

        const result = await getUtilization(from, to);

        res.json(result);
    } catch (err) {
        next(err);
    }
});

export default router;