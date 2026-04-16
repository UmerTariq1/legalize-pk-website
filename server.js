const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const staticDir = path.resolve(__dirname);

app.use(express.static(staticDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

app.listen(PORT, () => {
  console.log("Server listening on port " + PORT);
});
