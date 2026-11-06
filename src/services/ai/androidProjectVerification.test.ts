import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(process.cwd(), 'jarvis-wearos-android');

const REQUIRED_FILES = [
  'settings.gradle.kts',
  'build.gradle.kts',
  'gradle.properties',
  'gradle/wrapper/gradle-wrapper.properties',
  'gradlew',
  'gradlew.bat',
  '.gitignore',
  'README.md',
  'app/build.gradle.kts',
  'app/proguard-rules.pro',
  'app/src/main/AndroidManifest.xml',
  'app/src/main/res/values/strings.xml',
  'app/src/main/res/values/themes.xml',
  'app/src/main/res/xml/backup_rules.xml',
  'app/src/main/res/xml/data_extraction_rules.xml',
  'app/src/main/java/com/jarvis/wear/MainActivity.kt',
  'app/src/main/java/com/jarvis/wear/navigation/JarvisWearNavHost.kt',
  'app/src/main/java/com/jarvis/wear/presentation/JarvisViewModel.kt',
  'app/src/main/java/com/jarvis/wear/ui/theme/Color.kt',
  'app/src/main/java/com/jarvis/wear/ui/theme/Type.kt',
  'app/src/main/java/com/jarvis/wear/ui/theme/Theme.kt',
  'app/src/main/java/com/jarvis/wear/ui/reactor/ArcReactorCanvas.kt',
  'app/src/main/java/com/jarvis/wear/ui/components/CircularHudComponents.kt',
  'app/src/main/java/com/jarvis/wear/ui/home/HomeScreen.kt',
  'app/src/main/java/com/jarvis/wear/ui/dialogue/DialogueScreen.kt',
  'app/src/main/java/com/jarvis/wear/ui/settings/SystemMatrixScreen.kt',
  'app/src/main/java/com/jarvis/wear/ai/AiProvider.kt',
  'app/src/main/java/com/jarvis/wear/ai/PersonalityEngine.kt',
  'app/src/main/java/com/jarvis/wear/voice/SpeechRecognitionManager.kt',
  'app/src/main/java/com/jarvis/wear/voice/TextToSpeechManager.kt',
  'app/src/main/java/com/jarvis/wear/data/security/CredentialVault.kt',
  'app/src/main/java/com/jarvis/wear/data/database/ConversationDatabase.kt',
  'app/src/main/java/com/jarvis/wear/data/preferences/SettingsRepository.kt',
  'app/src/main/java/com/jarvis/wear/suggestions/AdaptiveSuggestionEngine.kt',
  'app/src/main/java/com/jarvis/wear/services/NetworkMonitor.kt',
  'app/src/main/java/com/jarvis/wear/services/JarvisHapticManager.kt',
  'app/src/main/java/com/jarvis/wear/device/DeviceControlManager.kt',
  'app/src/test/java/com/jarvis/wear/JarvisUnitTests.kt',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'CHANGELOG.md',
  'PUBLISHING_CHECKLIST.md',
  '.editorconfig',
  '.github/workflows/android-ci.yml',
  '.github/ISSUE_TEMPLATE/bug_report.md',
  '.github/ISSUE_TEMPLATE/feature_request.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'docs/ARCHITECTURE.md',
  'docs/BUILDING.md',
  'docs/CONFIGURATION.md',
  'docs/FEATURES.md',
  'docs/DEVELOPMENT_STATUS.md',
  'docs/TROUBLESHOOTING.md',
  'screenshots/README.md',
];

describe('JARVIS V3 Standalone Native Wear OS Android Project Verification', () => {
  it('contains all required Android Studio project files with non-empty source code', () => {
    for (const relPath of REQUIRED_FILES) {
      const fullPath = path.join(PROJECT_ROOT, relPath);
      assert.ok(fs.existsSync(fullPath), `Missing required Android project file: ${relPath}`);
      const content = fs.readFileSync(fullPath, 'utf-8').trim();
      assert.ok(content.length > 20, `File ${relPath} is unexpectedly empty or truncated`);
    }
  });

  it('configures AndroidManifest.xml with standalone Wear OS metadata and permissions', () => {
    const manifest = fs.readFileSync(
      path.join(PROJECT_ROOT, 'app/src/main/AndroidManifest.xml'),
      'utf-8'
    );
    assert.ok(manifest.includes('android.hardware.type.watch'));
    assert.ok(manifest.includes('android.permission.RECORD_AUDIO'));
    assert.ok(manifest.includes('android.permission.INTERNET'));
    assert.ok(manifest.includes('android.permission.ACCESS_NETWORK_STATE'));
    assert.ok(manifest.includes('android.permission.WAKE_LOCK'));
    assert.ok(manifest.includes('android.permission.VIBRATE'));
    assert.ok(manifest.includes('com.google.android.wearable.standalone'));
    assert.ok(manifest.includes('android:usesCleartextTraffic="false"'));
    assert.ok(manifest.includes('android:fullBackupContent="@xml/backup_rules"'));
    assert.ok(manifest.includes('android:dataExtractionRules="@xml/data_extraction_rules"'));
  });

  it('configures build.gradle.kts with AGP 8.6.1 and app/build.gradle.kts for Samsung Galaxy Watch 4 (compileSdk = 35, minSdk = 30, targetSdk = 34)', () => {
    const rootGradle = fs.readFileSync(
      path.join(PROJECT_ROOT, 'build.gradle.kts'),
      'utf-8'
    );
    assert.ok(rootGradle.includes('id("com.android.application") version "8.6.1" apply false'));

    const buildGradle = fs.readFileSync(
      path.join(PROJECT_ROOT, 'app/build.gradle.kts'),
      'utf-8'
    );
    assert.ok(buildGradle.includes('minSdk = 30'));
    assert.ok(buildGradle.includes('compileSdk = 35'));
    assert.ok(buildGradle.includes('targetSdk = 34'));
    assert.ok(buildGradle.includes('androidx.wear.compose:compose-material3'));
    assert.ok(buildGradle.includes('androidx.room:room-ktx'));
    assert.ok(buildGradle.includes('androidx.security:security-crypto'));
    assert.ok(buildGradle.includes('com.squareup.okhttp3:okhttp'));
  });

  it('implements all 4 Arc Reactor themes, 6 operational states, and AOD mode in ArcReactorCanvas.kt', () => {
    const reactorCode = fs.readFileSync(
      path.join(PROJECT_ROOT, 'app/src/main/java/com/jarvis/wear/ui/reactor/ArcReactorCanvas.kt'),
      'utf-8'
    );
    assert.ok(reactorCode.includes('ReactorTheme.MARK_I'));
    assert.ok(reactorCode.includes('ReactorTheme.MARK_II'));
    assert.ok(reactorCode.includes('ReactorTheme.MARK_III'));
    assert.ok(reactorCode.includes('ReactorTheme.NANO'));
    assert.ok(reactorCode.includes('OperationalState.LISTENING'));
    assert.ok(reactorCode.includes('OperationalState.PROCESSING'));
    assert.ok(reactorCode.includes('OperationalState.SPEAKING'));
    assert.ok(reactorCode.includes('OperationalState.DISCONNECTED'));
    assert.ok(reactorCode.includes('OperationalState.ERROR'));
    assert.ok(reactorCode.includes('drawAmbientReactor'));
  });

  it('implements OpenAI, Gemini, and Custom OpenAI-compatible providers and fail-closed Android Keystore vault', () => {
    const aiCode = fs.readFileSync(
      path.join(PROJECT_ROOT, 'app/src/main/java/com/jarvis/wear/ai/AiProvider.kt'),
      'utf-8'
    );
    assert.ok(aiCode.includes('class OpenAiProvider'));
    assert.ok(aiCode.includes('class GeminiProvider'));
    assert.ok(aiCode.includes('class CustomOpenAiCompatibleProvider'));
    assert.ok(aiCode.includes('fun validateHttpsBaseUrl'));
    assert.ok(aiCode.includes('fun sanitizeErrorMessage'));
    assert.ok(aiCode.includes('fun sanitizeThrowable'));
    assert.ok(aiCode.includes('x-goog-api-key'));

    const vaultCode = fs.readFileSync(
      path.join(PROJECT_ROOT, 'app/src/main/java/com/jarvis/wear/data/security/CredentialVault.kt'),
      'utf-8'
    );
    assert.ok(vaultCode.includes('EncryptedSharedPreferences'));
    assert.ok(vaultCode.includes('AES256_GCM'));
    assert.ok(vaultCode.includes('isHardwareEncrypted'));
    assert.ok(vaultCode.includes('isPersistentStorageAvailable'));
    assert.ok(vaultCode.includes('volatileMemoryFallback'));
    assert.ok(!vaultCode.includes('getSharedPreferences('));
  });
});
