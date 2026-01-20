import "dotenv/config";
import express from "express";
import { handler as ingest } from "../handlers/ingest";
import { handler as posts } from "../handlers/posts";

const app = express();
app.use(express.json());

// Local dev endpoint mirroring API Gateway's /ingest
app.post("/ingest", async (req, res) => {
  try {
    const out = await ingest({ body: req.body });
    const status = (out as any)?.statusCode ?? 200;
    const body = (out as any)?.body ?? "{}";
    res.status(status).send(body);
  } catch (e: any) {
    console.error(e);
    res.status(500).send({ error: e?.message || "internal error" });
  }
});

app.get("/posts", async (_req, res) => {
  try {
    const out = await posts({});
    const status = (out as any)?.statusCode ?? 200;
    const body = (out as any)?.body ?? "{}";
    res.status(status).send(body);
  } catch (e: any) {
    console.error(e);
    res.status(500).send({ error: e?.message || "internal error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Local API listening on :${port}`));
