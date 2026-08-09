@echo off
rem تشغيل الواجهة للتجربة E2E — ينشئ دفعات Vite على http://localhost:5173
setlocal
cd /d "%~dp0..\apps\web"
npm run dev