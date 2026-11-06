@rem
@rem Gradle startup script for Windows — J.A.R.V.I.S. for Wear OS (V6)
@rem
@if "%DEBUG%"=="" @echo off
set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
set APP_HOME=%DIRNAME%

if defined JAVA_HOME (
    set JAVA_EXE="%JAVA_HOME%\bin\java.exe"
) else (
    set JAVA_EXE=java.exe
)

set CLASSPATH="%APP_HOME%\gradle\wrapper\gradle-wrapper.jar"

if not exist %CLASSPATH% (
    where gradle >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        gradle %*
        exit /b %ERRORLEVEL%
    ) else (
        echo [JARVIS BUILD] Opening in Android Studio will automatically download Gradle 8.7.
        echo Alternatively, if Gradle is installed on PATH, run: gradle wrapper
        exit /b 1
    )
)

%JAVA_EXE% -Xmx64m -Xms64m -classpath %CLASSPATH% org.gradle.wrapper.GradleWrapperMain %*
