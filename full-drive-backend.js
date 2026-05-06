const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const upload = multer({ dest: 'tmp/' });
const TEMP = path.join(__dirname, 'tmp');
if (!fs.existsSync(TEMP)) fs.mkdirSync(TEMP, { recursive: true });

const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets'
  ]
});
const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function uploadToDrive(filePath, fileName, mimeType) {
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: FOLDER_ID ? [FOLDER_ID] : undefined },
    media: { mimeType, body: fs.createReadStream(filePath) },
    fields: 'id,name,webViewLink'
  });
  return res.data;
}

async function appendRow(values) {
  if (!SHEET_ID) return null;
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:Z',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] }
  });
  return res.data.updates.updatedRange;
}

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'audio file required' });
    const uploaded = await uploadToDrive(req.file.path, req.file.originalname, req.file.mimetype || 'application/octet-stream');
    await appendRow(['audio', req.file.originalname, req.file.size, new Date().toISOString(), uploaded.id, uploaded.webViewLink || '']);
    fs.unlinkSync(req.file.path);
    res.json({ ok: true, drive: uploaded });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/upload-base64', async (req, res) => {
  try {
    const { fileName, base64Data, mimeType } = req.body || {};
    if (!fileName || !base64Data) return res.status(400).json({ ok: false, message: 'missing data' });
    const clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buffer = Buffer.from(clean, 'base64');
    const tempFile = path.join(TEMP, `${Date.now()}-${fileName}`.replace(/[^a-z0-9_.-]/gi, '_'));
    fs.writeFileSync(tempFile, buffer);
    const uploaded = await uploadToDrive(tempFile, fileName, mimeType || 'application/octet-stream');
    await appendRow(['audio-base64', fileName, buffer.length, new Date().toISOString(), uploaded.id, uploaded.webViewLink || '']);
    fs.unlinkSync(tempFile);
    res.json({ ok: true, drive: uploaded });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/upload-sheet', async (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!SHEET_ID) return res.status(400).json({ ok: false, message: 'SHEET_ID missing' });
    if (!Array.isArray(rows)) return res.status(400).json({ ok: false, message: 'rows required' });
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:Z',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows }
    });
    res.json({ ok: true, updatedRange: result.data.updates.updatedRange });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(process.env.PORT || 8000, () => console.log('Drive backend running'));
