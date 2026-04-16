const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const staticDir = path.resolve(__dirname);

app.use(express.static(staticDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

app.get(["/article", "/article/:id"], (req, res) => {
  res.sendFile(path.join(staticDir, "article", "index.html"));
});

app.get(["/amendment", "/amendment/:n"], (req, res) => {
  res.sendFile(path.join(staticDir, "amendment", "index.html"));
});

app.get(["/diff", "/diff/:article"], (req, res) => {
  res.sendFile(path.join(staticDir, "diff", "index.html"));
});

// Port Netlify function logic for Render
const githubProxyHandler = require("./netlify/functions/github-proxy").handler;

app.all("/.netlify/functions/github-proxy", async (req, res) => {
  try {
    const event = {
      httpMethod: req.method,
      queryStringParameters: req.query,
      headers: req.headers,
    };

    const response = await githubProxyHandler(event);
    
    if (response.headers) {
      for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value);
      }
    }
    
    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error("Error executing github-proxy:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get(["/timeline", "/timeline/:id"], (req, res) => {
  res.sendFile(path.join(staticDir, "timeline", "index.html"));
});

app.get(["/search", "/search/:id"], (req, res) => {
  res.sendFile(path.join(staticDir, "search", "index.html"));
});

app.get(["/constitution", "/constitution/:id"], (req, res) => {
  res.sendFile(path.join(staticDir, "constitution", "index.html"));
});

app.get(["/explore", "/explore/:id"], (req, res) => {
  res.sendFile(path.join(staticDir, "explore", "index.html"));
});

app.listen(PORT, () => {
  console.log("Server listening on port " + PORT);
});
