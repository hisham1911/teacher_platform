@echo off
rem تشغيل الـAPI ببيئة E2E (بيئة مدارة في Git — لا تعتمد على appsettings.Development.json غير المتعقب)
setlocal
set ASPNETCORE_ENVIRONMENT=E2E
cd /d "%~dp0..\backend\src\TeacherPlatform.Api"
dotnet run --no-launch-profile --urls http://localhost:5000