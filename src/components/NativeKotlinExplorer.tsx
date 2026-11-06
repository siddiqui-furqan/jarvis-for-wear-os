import React, { useEffect, useState } from 'react';
import {
  Check,
  Code,
  Copy,
  Download,
  FileCode,
  FolderTree,
  ShieldCheck,
  Smartphone,
  Terminal,
  Wrench,
} from 'lucide-react';

interface ProjectFileItem {
  path: string;
  content: string;
  size: number;
}

export const NativeKotlinExplorer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [files, setFiles] = useState<ProjectFileItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('app/build.gradle.kts');
  const [activeView, setActiveView] = useState<'code' | 'build_guide'>('code');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/android-project/files')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.files) && data.files.length > 0) {
          setFiles(data.files);
          if (!data.files.some((f: ProjectFileItem) => f.path === selectedPath)) {
            setSelectedPath(data.files[0].path);
          }
        }
      })
      .catch(() => {
        // Fallback handled gracefully
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const currentFile =
    files.find((f) => f.path === selectedPath) ||
    files[0] || {
      path: 'app/build.gradle.kts',
      content: '// Loading native Wear OS project files...',
      size: 0,
    };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-6xl h-[88vh] bg-slate-950 border border-cyan-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-cyan-900/60 bg-gradient-to-r from-slate-950 via-cyan-950/30 to-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/50 shadow-[0_0_12px_rgba(0,240,255,0.4)]">
              <Smartphone className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-hud text-sm sm:text-base font-bold tracking-wider text-cyan-200">
                  J.A.R.V.I.S. V6 — NATIVE WEAR OS ANDROID STUDIO PROJECT
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code bg-emerald-950 text-emerald-300 border border-emerald-700/70">
                  {files.length || 37} Project Files • v6.0.0-SM-R860
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono-code">
                Samsung Galaxy Watch 4 (SM-R860 • 40mm • 396×396 Reference + 9-Profile Responsive Circular Matrix) • Min SDK 30 • Jetpack Compose for Wear OS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView(activeView === 'code' ? 'build_guide' : 'code')}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono-code flex items-center gap-1.5 transition-all ${
                activeView === 'build_guide'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                  : 'bg-slate-900 hover:bg-slate-800 border-cyan-800 text-cyan-300'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{activeView === 'build_guide' ? 'View Source Tree' : 'Windows Build & ADB Guide'}</span>
            </button>

            <a
              href="/api/android-project/download"
              download="jarvis-wearos-sm-r860-v6.zip"
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-xs font-mono-code flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.3)] active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Android Studio Project (.ZIP)</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Close architecture explorer"
            >
              ✕
            </button>
          </div>
        </div>

        {activeView === 'build_guide' ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5 font-mono-code text-xs leading-relaxed">
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-700/60">
              <h3 className="font-hud text-sm font-bold text-emerald-300 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>SM-R860 V6 CIRCULAR UI REFINEMENT &amp; RESPONSIVE ARCHITECTURE (6.0.0-SM-R860)</span>
              </h3>
              <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                <li>
                  <strong>Symmetric 3-Slot Circular Header &amp; Single-Button System Matrix Dock (<code className="text-cyan-300">CircularHudComponents.kt</code> + <code className="text-cyan-300">SystemMatrixScreen.kt</code>):</strong> Top navigation uses a symmetric 3-slot circular safe header (<code className="text-cyan-300">[Back] | [Centered Screen Title] | [HOME]</code>) seated inside the top safe chord. Removed the duplicate bottom Back button and permanently visible bottom Trash button from System Matrix, leaving a single centered <code className="text-cyan-300">SAVE CONFIG</code> button in <code className="text-cyan-300">CurvedPrimaryActionDock</code>.
                </li>
                <li>
                  <strong>De-Cluttered Home Top Telemetry Bar (<code className="text-cyan-300">CircularHudComponents.kt</code>):</strong> Removed the AI provider label from the Home top bar, displaying only <strong>Time · Wi-Fi Icon · Battery %</strong> centered inside the top circular safe chord.
                </li>
                <li>
                  <strong>Responsive Circular Wear OS Architecture Across 9 Round-Display Profiles (<code className="text-cyan-300">CircularResponsiveSpec</code> + <code className="text-cyan-300">BoxWithConstraints</code>):</strong> Dynamically computes circular chord widths, reactor diameter, invariant caption slot height, and font scaling across <code className="text-cyan-300">320×320</code>, <code className="text-cyan-300">360×360</code>, <code className="text-cyan-300">384×384</code>, <code className="text-cyan-300">396×396</code> (GW4 40mm reference), <code className="text-cyan-300">400×400</code>, <code className="text-cyan-300">416×416</code>, <code className="text-cyan-300">432×432</code>, <code className="text-cyan-300">450×450</code>, and <code className="text-cyan-300">480×480</code>.
                </li>
                <li>
                  <strong>Preserved V5 Native Capabilities:</strong> In-place Home voice lifecycle, invariant reserved Home caption slot, typed message submission decoupled from speech recognition, Gemini/OpenAI/Custom providers, device-control actions &amp; confirmations, haptics, rotary bezel support, and British male TTS.
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/60">
              <h3 className="font-hud text-sm font-bold text-cyan-300 mb-2 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-cyan-400" />
                <span>1. WINDOWS BUILD INSTRUCTIONS (ANDROID STUDIO / GRADLE)</span>
              </h3>
              <p className="text-slate-300 mb-2">
                Unzip <code className="text-cyan-300">jarvis-wearos-sm-r860-v6.zip</code> and open the{' '}
                <code className="text-cyan-300">jarvis-wearos-android</code> folder in{' '}
                <strong>Android Studio Ladybug (2024.2+)</strong> with <strong>JDK 17</strong> and{' '}
                <strong>Android SDK API 34 / API 30</strong> installed.
              </p>
              <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-cyan-200 overflow-x-auto">
{`# In Windows PowerShell:
cd jarvis-wearos-android
$env:JAVA_HOME="C:\\Program Files\\Android\\Android Studio\\jbr"
.\\gradlew.bat clean assembleDebug testDebugUnitTest

# Output Debug APK Path:
# app\\build\\outputs\\apk\\debug\\app-debug.apk`}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <h3 className="font-hud text-sm font-bold text-cyan-300 mb-2 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>2. WIRELESS ADB INSTALLATION FOR SAMSUNG GALAXY WATCH 4 (SM-R860)</span>
              </h3>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 mb-3">
                <li>
                  To ensure the new <strong>JARVIS Arc Reactor Launcher Icon</strong> refreshes in the One UI Watch app drawer, uninstall any old debug build first (<code className="text-cyan-300">adb uninstall com.jarvis.wear.debug</code>), then install the updated APK.
                </li>
                <li>
                  On your Galaxy Watch 4, ensure <strong>Settings → General → Text-to-speech → Preferred engine</strong> is set to <strong>Speech Recognition &amp; Synthesis from Google</strong> (or download the English UK voice pack) for the richest offline British male voices (<code className="text-cyan-300">en-gb-x-rjs-local</code>).
                </li>
              </ol>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-cyan-200 overflow-x-auto">
{`# Step A: Connect to the watch's Wireless Debugging port
adb connect <WATCH_IP>:<CONNECTION_PORT>

# Step B: Remove old package so Wear OS Launcher refreshes the icon cache
adb -s <WATCH_IP>:<CONNECTION_PORT> uninstall com.jarvis.wear.debug

# Step C: Install the updated standalone JARVIS V3.1 debug APK
adb -s <WATCH_IP>:<CONNECTION_PORT> install -r app\\build\\outputs\\apk\\debug\\app-debug.apk`}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <h3 className="font-hud text-sm font-bold text-cyan-300 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>3. CONFIGURING BYOK API KEYS &amp; BRITISH MALE VOICE ON THE WATCH</span>
              </h3>
              <p className="text-slate-300">
                1. Launch <strong>JARVIS</strong> on the watch and tap the bottom-right <strong>Settings</strong> node to open the 6-node radial <strong>System Matrix</strong>.<br />
                2. Tap <strong>AI LINK</strong>, choose <strong>GEMINI</strong>, <strong>OPENAI</strong>, or <strong>ROUTER</strong>, enter your API key (or inject via ADB while focused:{' '}
                <code className="text-cyan-300">adb shell input text &quot;YOUR_API_KEY&quot;</code>), and tap <strong>SAVE KEY</strong>.<br />
                3. Return to the hub and tap <strong>VOICE</strong>: select <strong>British (UK)</strong>, tap the <strong>System Voice Synthesizer</strong> row to cycle through installed watch voices, and tap <strong>▶ PREVIEW VOICE</strong> to hear JARVIS speak immediately.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left File Tree Sidebar */}
            <div className="w-72 border-r border-slate-800 bg-slate-900/60 flex flex-col overflow-hidden shrink-0">
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2 text-xs font-mono-code text-cyan-300">
                <FolderTree className="w-3.5 h-3.5" />
                <span>jarvis-wearos-android/</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loading && files.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 font-mono-code">Loading project tree...</div>
                ) : (
                  files.map((file) => {
                    const active = file.path === currentFile.path;
                    const parts = file.path.split('/');
                    const fileName = parts[parts.length - 1];
                    const shortDir = parts
                      .slice(0, -1)
                      .join('/')
                      .replace('app/src/main/java/com/jarvis/wear', 'com.jarvis.wear')
                      .replace('app/src/test/java/com/jarvis/wear', 'test/com.jarvis.wear');
                    return (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => setSelectedPath(file.path)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-mono-code flex items-start gap-2 transition-all ${
                          active
                            ? 'bg-cyan-950/90 text-cyan-200 border border-cyan-500/60 font-bold'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/50 border border-transparent'
                        }`}
                      >
                        <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold" title={fileName}>
                            {fileName}
                          </div>
                          {shortDir && (
                            <div className="truncate text-[9.5px] text-slate-500 font-normal" title={file.path}>
                              {shortDir}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Source Code Viewer */}
            <div className="flex-1 flex flex-col overflow-hidden p-4 bg-slate-950">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-cyan-400" />
                  <span className="font-mono-code text-xs font-bold text-cyan-200">
                    jarvis-wearos-android/{currentFile.path}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono-code bg-slate-900 border border-slate-800 text-slate-400">
                    {currentFile.size} bytes
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-cyan-800 hover:border-cyan-400 text-cyan-300 text-xs font-mono-code active:scale-95 transition-all"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copied ? 'COPIED' : 'COPY FILE'}</span>
                </button>
              </div>

              <pre className="flex-1 overflow-auto bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs font-mono-code text-cyan-100 leading-relaxed shadow-inner">
                <code>{currentFile.content}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
