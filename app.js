const mongoose = require('mongoose');
const express = require('express');
const qr = require('qr-image');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs'); // For file operations
const { v4: uuidv4 } = require('uuid'); // For unique filenames

// MongoDB connection URI
const mongoURI = 'mongodb+srv://jayendrakumar:jayendrakumar@cluster0.washlax.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'; // Ensure this starts with "mongodb://" or "mongodb+srv://"

// Mongoose Schema for QR code storage
const QRCodeSchema = new mongoose.Schema({
    link: { type: String, required: true }, // The link to be stored in the database
    filename: { type: String, required: true }, // The filename of the saved QR code
    createdAt: { type: Date, default: Date.now }, // Timestamp
});

// Mongoose Model based on the QRCodeSchema
const QRCodeModel = mongoose.model('QRCode', QRCodeSchema);

const app = express();
const port = 3000;

// Body parser to handle form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // For serving static files (e.g., QR code images)

// Ensure the 'public/qr_codes' directory exists
const qrCodesDir = path.join(__dirname, 'public', 'qr_codes');
if (!fs.existsSync(qrCodesDir)) {
    fs.mkdirSync(qrCodesDir, { recursive: true });
}

// Serve the index.html file on the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint to generate and save QR code
app.post('/generate', async (req, res) => {
    const link = req.body.link; // The link to be stored and used to generate the QR code
    if (!link) {
        return res.status(400).send('Link is required.');
    }

    try {
        // Generate a unique filename for the QR code
        const filename = `${uuidv4()}.png`;
        const filepath = path.join(qrCodesDir, filename);

        // Create a writable stream to save the QR code to a file
        const qr_png = qr.image(link, { type: 'png' });
        const writeStream = fs.createWriteStream(filepath);

        // Pipe the QR code data to the writable stream
        qr_png.pipe(writeStream);

        // Wait for the stream to finish writing
        writeStream.on('finish', async () => {
            // Save the link and QR code information to MongoDB
            const qrCodeData = {
                link,
                filename,
            };

            await QRCodeModel.create(qrCodeData); // Store in MongoDB

            // Return the QR code file to the client
            res.setHeader('Content-Type', 'image/png');
            fs.createReadStream(filepath).pipe(res);
        });

        writeStream.on('error', (err) => {
            console.error('Error writing QR code file:', err.message);
            res.status(500).send('Error generating QR code.');
        });
    } catch (err) {
        console.error('Error generating QR code:', err.message);
        res.status(500).send('Error generating QR code.');
    }
});

// Connect to MongoDB and start the server
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('Connected to MongoDB');
        // Start the server after connecting to MongoDB
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB:', err.message);
    });
