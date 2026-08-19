const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "FixAI backend is running"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { image, description } = req.body;

    if (!image && !description) {
      return res.status(400).json({
        error: "Image or description is required"
      });
    }

    const prompt = `
You are FixAI, an AI assistant that helps diagnose problems
with cars, machines, tools, appliances and other equipment.

Analyze the information provided by the user.

User description:
${description || "No description provided"}

Return:
1. Most likely problem
2. Possible causes
3. Recommended repair steps
4. Parts or tools that may be needed
5. Safety warnings
`;

    res.json({
      success: true,
      message: "FixAI request received",
      prompt: prompt,
      imageReceived: Boolean(image)
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`FixAI backend running on port ${PORT}`);
});
