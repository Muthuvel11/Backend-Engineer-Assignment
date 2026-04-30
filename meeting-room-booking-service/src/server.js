import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Meeting Room Booking API is running');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
