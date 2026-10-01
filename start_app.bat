@echo off
title Olympics Athlete Showcase
echo Starting Olympics Athlete Showcase Server...
cd /d "%~dp0"
start "" "http://localhost:3000"
node server.js
pause
