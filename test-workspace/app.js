const express = require('express');
const app = express();

// Hardcoded secret (should be flagged)
const JWT_SECRET = "apiSECRET_XYZ_12345";

function requireRole(role) {
  return (req, res, next) => {
    if (req.headers['x-role'] === role) return next();
    return res.status(403).send('forbidden');
  };
}

// Missing auth middleware — should be flagged by Semgrep
app.get('/admin', (req, res) => { res.send('admin portal'); });

// Properly protected route — should NOT be flagged
app.get('/billing', requireRole('admin'), (req, res) => { res.send('billing'); });

app.listen(3000);
