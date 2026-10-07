import { spawn } from "node:child_process";
import path from "node:path";

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  // CORS headers — required for browser requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const query = req.query.query || req.query.url;
  const format = req.query.format;

  if (!query) {
    return res.status(400).json({ error: '"query" parameter is required' });
  }

  try {
    // Build yt-dlp arguments — JSON output mode
    const args = ["-J", "--no-warnings", "--no-playlist"];
    if (format) {
      args.push("-f", format);
    }
    args.push(query);

    // Spawn the bundled ytdlp.py with python3
    const ytdlpPath = path.join(process.cwd(), "api", "ytdlp.py");
    const proc = spawn("python3", [ytdlpPath, ...args], {
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        console.error("[info] ytdlp failed:", stderr);
        return res.status(400).json({
          error: stderr || `yt-dlp exited with code ${code}`
        });
      }

      try {
        const info = JSON.parse(stdout);
        res.status(200).json(info);
      } catch (parseErr) {
        res.status(500).json({
          error: "Failed to parse yt-dlp output",
          raw: stdout.slice(0, 500)
        });
      }
    });

    proc.on("error", (err) => {
      res.status(500).json({ error: `Failed to spawn python3: ${err.message}` });
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
