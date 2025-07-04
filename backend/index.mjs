import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import multer from "multer";
import fs from "fs";
import vision from "@google-cloud/vision";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(bodyParser.json());

// Serve frontend static files from 'public' folder
app.use(express.static(path.join(__dirname, "public")));

// Route for homepage - serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Set up file upload
const upload = multer({ dest: "uploads/" });

// Google Cloud Vision setup
const visionCredentials = JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS);
const client = new vision.ImageAnnotatorClient({ credentials: visionCredentials });

// Route for generating recipe (text input)
app.post("/generate-recipe", async (req, res) => {
  const { prompt, context } = req.body;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${context}\n\n${prompt}` }] }],
        }),
      }
    );

    const data = await response.json();

    console.log("Gemini API response:");
    console.dir(data, { depth: null });

    res.json(data);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ error: "Failed to generate recipe" });
  }
});

// Route for image-based ingredient extraction
app.post("/recognize-image", upload.array("images"), async (req, res) => {
  try {
    const allLabels = [];
    console.log("Image files received:", req.files);

    for (const file of req.files) {
      console.log("Start process image");
      const [result] = await client.labelDetection(file.path);
      const labels = result.labelAnnotations.map((label) => label.description);
      allLabels.push(...labels); // Flatten all labels into one array
      fs.unlinkSync(file.path); // Clean up uploaded file
    }

    console.log("Extracted labels from image:", allLabels);

    // Optionally deduplicate ingredients
    const uniqueLabels = [...new Set(allLabels)];

    res.json({ labels: uniqueLabels });
  } catch (error) {
    console.error("Vision API error:", error);
    res.status(500).json({ error: "Failed to analyze images" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});


// Route to check if labels are food-related using Gemini
app.post("/check-if-food", async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();

    // Return Gemini's full response (your frontend will extract true/false)
    res.json(data);
  } catch (error) {
    console.error("Error calling Gemini for food check:", error);
    res.status(500).json({ error: "Failed to check food label" });
  }
});
