@echo off
REM Build script: packages camera_overlay.py into a standalone Windows executable

REM Step 1: Check if PyInstaller is installed; install if missing
python -m pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo PyInstaller not found. Installing via pip...
    python -m pip install pyinstaller
)

REM Step 2: Ensure 'dist' directory exists
if not exist dist (
    mkdir dist
)

REM Step 3: Set icon option if icon file is available
set ICON_FILE=resources/app_icon.ico
set ICON_OPTION=
if exist "%ICON_FILE%" (
    echo Embedding icon from %ICON_FILE%
    set ICON_OPTION=--icon "%ICON_FILE%"
) else (
    echo Icon file not found at %ICON_FILE%. Proceeding without custom icon.
)

REM Step 4: Run PyInstaller to build a single executable without console
pyinstaller --onefile --noconsole %ICON_OPTION% --distpath dist camera_overlay.py

REM Optional cleanup of build artifacts
REM rmdir /s /q build
REM del camera_overlay.spec

echo Build complete. Executable is in the 'dist' folder.
pause 