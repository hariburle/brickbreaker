@echo off
REM Start a simple HTTP server for Phaser game
REM Usage: Double-click this file in Windows Explorer
REM The server will run on http://localhost:8080

cd /d %~dp0
python -m http.server 2002
pause
