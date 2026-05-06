# Full setup

## Install
npm init -y
npm i express cors multer googleapis google-auth-library

## Env
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id
GOOGLE_SHEET_ID=your_sheet_id
PORT=8000

## Google Cloud
1. Enable Drive API and Sheets API.
2. Create a service account and download JSON key.
3. Share the Drive folder and Sheets file with the service account email.

## Endpoints
- GET /health
- POST /upload-audio
- POST /upload-base64
- POST /upload-sheet

## Frontend
Set backendUrl in the browser localStorage or hardcode it in the recorder page.
