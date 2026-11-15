@echo off
REM Start Diraya locally on Windows: http://127.0.0.1:8000
cd /d "%~dp0"
REM Thmanyah (Arabic typeface): your own copy in fonts-local\ on this computer only. Import it from Downloads if missing.
if not exist "fonts-local\thmanyah\thmanyahsans-Regular.woff2" (
  if exist "%USERPROFILE%\Downloads\Thmanyah-Font-Family.zip" python backend\scripts\add_thmanyah.py "%USERPROFILE%\Downloads\Thmanyah-Font-Family.zip"
)
cd backend
python -c "import starlette, uvicorn, sklearn, pandas" 2>NUL || python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
