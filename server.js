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

app.listen(PORT, () => {
  console.log("Server listening on port " + PORT);
});
