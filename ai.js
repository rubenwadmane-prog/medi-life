const router = require('express').Router();
const https  = require('https');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// ─── POST /api/ai/analyse ─────────────────────────────────────────────────────
// Secure server-side proxy to Anthropic — keeps API key off the client
router.post('/analyse', (req, res) => {
  const { symptoms, mode } = req.body;
  if (!symptoms) return res.status(400).json({ error: 'symptoms required' });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });

  const prompt = mode === 'offline' ? buildOfflinePrompt(symptoms) : buildOnlinePrompt(symptoms);

  const payload = JSON.stringify({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: prompt }],
  });

  const options = {
    hostname: 'api.anthropic.com',
    path:     '/v1/messages',
    method:   'POST',
    headers:  {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length':    Buffer.byteLength(payload),
    },
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => { data += chunk; });
    apiRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) return res.status(502).json({ error: parsed.error.message });
        const text = (parsed.content || []).map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
        const result = JSON.parse(text);
        res.json({ result, mode });
      } catch (e) {
        console.error('AI parse error:', e.message, data.slice(0, 300));
        res.status(502).json({ error: 'Failed to parse AI response' });
      }
    });
  });

  apiReq.on('error', err => {
    console.error('Anthropic request error:', err);
    res.status(502).json({ error: 'Failed to reach AI service' });
  });

  apiReq.write(payload);
  apiReq.end();
});

// ─── Prompt builders ──────────────────────────────────────────────────────────
function buildOnlinePrompt(symptoms) {
  return `You are Arogya, a trusted AI medical assistant. Patient symptoms: "${symptoms}"

Return ONLY a valid JSON object (no markdown, no backticks, no extra text):
{
  "summary": "2-3 sentence plain assessment",
  "possibleConditions": ["condition1", "condition2"],
  "specialistType": "e.g. General Physician",
  "urgency": "routine",
  "doctors": [
    {"name":"Dr. Indian Name","spec":"Specialisation","distance":"0.8 km","rating":4.7,"hospital":"Hospital Name Panvel","type":"nearby"},
    {"name":"Dr. Indian Name","spec":"Specialisation","distance":"1.5 km","rating":4.8,"hospital":"Hospital Name Navi Mumbai","type":"nearby"},
    {"name":"Dr. Indian Name","spec":"Specialisation","distance":"Remote","rating":5.0,"hospital":"Kokilaben Dhirubhai Ambani Hospital","type":"best"}
  ],
  "warning": ""
}
urgency must be one of: routine, soon, urgent, emergency.
Use realistic Indian doctor names and hospitals near Panvel, Maharashtra.`;
}

function buildOfflinePrompt(symptoms) {
  return `You are Arogya, a doctor giving safe home advice when no clinic is reachable. Patient: "${symptoms}"

Return ONLY a valid JSON object (no markdown, no backticks, no extra text):
{
  "summary": "2-3 sentence doctor-perspective assessment",
  "likelyCause": "most likely cause",
  "remedies": ["Detailed remedy step 1","Detailed remedy step 2","Detailed remedy step 3","Detailed remedy step 4"],
  "avoidList": ["thing to avoid 1","thing to avoid 2"],
  "seekDoctorIf": "specific condition requiring immediate doctor visit",
  "warning": ""
}
Include safe ayurvedic and evidence-based home remedies appropriate for Indian context.`;
}

module.exports = router;
