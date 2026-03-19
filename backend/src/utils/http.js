function badRequest(res, message, details) {
  return res.status(400).json({ error: message, details });
}

function notFound(res, message) {
  return res.status(404).json({ error: message ?? "Not found" });
}

module.exports = { badRequest, notFound };

