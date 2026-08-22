import express from "express";
import OpenAI from "openai";
import admin from "firebase-admin";

const app = express();
app.use(express.json({ limit: "1mb" }));

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-5-mini";

function clean(value, max = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

async function requireFirebaseUser(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: "Missing Firebase ID token." });
    }
    req.user = await admin.auth().verifyIdToken(match[1]);
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Invalid or expired Firebase ID token." });
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "fixai-backend" });
});

app.post("/diagnose", requireFirebaseUser, async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
    }

    const vehicle = clean(req.body?.vehicle, 500);
    const symptoms = clean(req.body?.symptoms, 5000);

    if (!vehicle && !symptoms) {
      return res.status(400).json({ error: "Provide vehicle or symptoms." });
    }

    const prompt = `
You are FixAI, an automotive diagnostic assistant. Analyze only the information supplied by the user.

Vehicle / machine: ${vehicle || "Not specified"}
Symptoms: ${symptoms || "Not specified"}

Return a concise Latvian-language diagnostic assessment. Include:
- 3 most plausible causes, ordered from most likely to least likely
- confidence for each cause as LOW / MEDIUM / HIGH (not fabricated percentages)
- concrete checks to perform next
- safety / whether driving should be avoided
- likely repair complexity: low / medium / high
- a short disclaimer that this is not a confirmed mechanical diagnosis

Do not claim certainty. If information is insufficient, say what additional symptoms, fault codes, measurements, or inspection results are needed.
`.trim();

    const response = await openai.responses.create({
      model,
      input: prompt
    });

    const result = response.output_text?.trim();
    if (!result) {
      throw new Error("OpenAI returned an empty response.");
    }

    const doc = {
      vehicle,
      symptoms,
      result,
      model,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const ref = await db
      .collection("users")
      .doc(req.user.uid)
      .collection("diagnoses")
      .add(doc);

    res.json({
      ok: true,
      diagnosisId: ref.id,
      result
    });
  } catch (error) {
    console.error("Diagnosis error:", error);
    res.status(500).json({ error: "AI diagnosis failed. Please try again." });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`FixAI backend listening on port ${port}`);
});
