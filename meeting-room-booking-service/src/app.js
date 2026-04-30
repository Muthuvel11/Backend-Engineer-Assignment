import express from "express";
import roomRoutes from "./routes/room.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import reportRoutes from "./routes/report.routes.js";

const app = express();
app.use(express.json({ type: ["application/json", "text/plain", "*/*"] }));

app.use("/rooms", roomRoutes);
app.use("/bookings", bookingRoutes);
app.use("/reports", reportRoutes);

app.use((err, req, res, next) => {
    const status = err.status || 500;
    const errorType =
        status === 400 ? "ValidationError" :
            status === 404 ? "NotFoundError" :
                status === 409 ? "ConflictError" :
                    "InternalError";

    res.status(status).json({
        error: err.error || errorType,
        message: err.message || "Internal Server Error"
    });
});

export default app;