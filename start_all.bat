@echo off
title AirEsprit Launcher

echo ======================================
echo         STARTING AIRESPRIT
echo ======================================

REM ======================================
REM 1 - Passport API
REM ======================================

start cmd /k "cd /d %~dp0python-API\passport-detection && call venv\Scripts\activate.bat && python app.py"

timeout /t 5 >nul

REM ======================================
REM 2 - NLP API
REM ======================================

start cmd /k "cd /d %~dp0python-API\nlp-reviews && call venv\Scripts\activate.bat && uvicorn distilbert_api:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 5 >nul

REM ======================================
REM 3 - React Frontend
REM ======================================

start cmd /k "cd /d %~dp0 && npm run dev"

REM ======================================
REM OPEN APP
REM ======================================

timeout /t 10 >nul
start http://localhost:5173

echo ======================================
echo      ALL SERVICES STARTED
echo ======================================

pause