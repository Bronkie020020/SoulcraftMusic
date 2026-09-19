@echo off
title Soulcraft Downloader
cd /d "%~dp0"
echo ===================================================
echo       Soulcraft Downloader wordt gestart...
echo ===================================================
echo.
echo Link: http://localhost:3000
echo Server start op de achtergrond en je browser opent automatisch.
echo.
start http://localhost:3000
npm run dev
