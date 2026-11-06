import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { getJarvisGreeting, getSimulatedJarvisResponse } from './src/services/ai/personality.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function collectAndroidProjectFiles(dirPath: string, baseDir: string): Array<{ path: string; content: string; size: number }> {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results: Array<{ path: string; content: string; size: number }> = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectAndroidProjectFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);
      const isBinaryAsset = relPath.endsWith('.png') || relPath.endsWith('.jar');
      const content = isBinaryAsset
        ? `// Binary Resource (${relPath})\n// Size: ${stat.size} bytes (Included in downloadable jarvis-wearos-sm-r860-v6.zip)`
        : fs.readFileSync(fullPath, 'utf-8');
      results.push({
        path: relPath,
        content,
        size: stat.size,
      });
    }
  }
  return results;
}

const DEFAULT_SERVER_GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'General text & multimodal tasks' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', description: 'Low-latency watch assistant model' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', description: 'Latest fast Gemini model' },
];

function resolveGeminiModel(requestedModel?: string): string {
  if (typeof requestedModel === 'string' && requestedModel.trim() !== '') {
    return requestedModel.trim().replace(/^models\//, '');
  }
  return 'gemini-3.8-flash';
}

function getEffectiveApiKey(clientProvidedKey?: string): string | undefined {
  if (clientProvidedKey && clientProvidedKey.trim() !== '') {
    return clientProvidedKey.trim();
  }
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey.trim() !== '' && envKey !== 'MY_GEMINI_API_KEY') {
    return envKey.trim();
  }
  return undefined;
}

function getGenAIClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildContents(
  history: Array<{ role: string; content: string }> | undefined,
  prompt: string
) {
  const safeHistory = Array.isArray(history) ? history.slice(-6) : [];
  return [
    ...safeHistory
      .filter((m) => m && typeof m.content === 'string' && m.content.trim() !== '')
      .map((m) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    {
      role: 'user',
      parts: [{ text: prompt }],
    },
  ];
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  // Serve generated Native Wear OS Android Studio Project files & ZIP archive
  app.get('/api/android-project/files', (_req, res) => {
    const projectRoot = path.join(__dirname, 'jarvis-wearos-android');
    const files = collectAndroidProjectFiles(projectRoot, projectRoot);
    res.json({
      projectName: 'jarvis-for-wear-os',
      displayName: 'J.A.R.V.I.S. for Wear OS',
      versionName: '6.0.0-SM-R860',
      versionCode: 6,
      targetDevice: 'Samsung Galaxy Watch 4 (SM-R860, 40mm, 396x396 + 9-Profile Round Matrix)',
      minSdk: 30,
      targetSdk: 34,
      fileCount: files.length,
      files,
    });
  });

  app.get('/api/android-project/download', (_req, res) => {
    const v6ZipPath = path.join(__dirname, 'public', 'jarvis-wearos-sm-r860-v6.zip');
    if (fs.existsSync(v6ZipPath)) {
      res.download(v6ZipPath, 'jarvis-for-wear-os-v6.zip');
    } else {
      res.status(404).json({ error: 'ZIP archive not found.' });
    }
  });

  // Audio Transcription Endpoint for Recorded Voice Input (gemini-3.5-transcribe)
  app.post('/api/gemini/transcribe', async (req, res) => {
    const { audioBase64, mimeType, apiKey: clientKey } = req.body ?? {};
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'Audio data is required.' });
      return;
    }

    const apiKey = getEffectiveApiKey(clientKey);
    if (!apiKey) {
      res.json({
        text: '',
        simulated: true,
        message: 'No GEMINI_API_KEY configured for server-side audio transcription.',
      });
      return;
    }

    const cleanMime =
      typeof mimeType === 'string' && mimeType.trim() !== ''
        ? mimeType.split(';')[0].trim()
        : 'audio/webm';

    try {
      const ai = getGenAIClient(apiKey);
      const audioPart = {
        inlineData: {
          mimeType: cleanMime,
          data: audioBase64,
        },
      };
      const promptPart = {
        text: 'Transcribe this spoken voice command into plain English text only. Return only the exact words spoken, without quotes or extra commentary. If there is no intelligible speech, return an empty string.',
      };

      let response: GenerateContentResponse;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: { parts: [audioPart, promptPart] },
        });
      } catch (_transcribeErr) {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts: [audioPart, promptPart] },
        });
      }

      const text = (response.text ?? '').trim();
      res.json({ text });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message, text: '' });
    }
  });

  // Dynamic Gemini Model Discovery Endpoint (Queries Google's Model Discovery API)
  app.post('/api/gemini/models', async (req, res) => {
    const apiKey = getEffectiveApiKey(req.body?.apiKey);
    if (!apiKey) {
      res.json({
        models: DEFAULT_SERVER_GEMINI_MODELS,
        simulated: true,
        message: 'Loaded active server-side Gemini models (add a custom Gemini API key to query your project models live).',
      });
      return;
    }

    try {
      const discoveryUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(discoveryUrl);
      if (!response.ok) {
        res.json({
          models: DEFAULT_SERVER_GEMINI_MODELS,
          message: 'Loaded supported Gemini models.',
        });
        return;
      }
      const data = (await response.json()) as {
        models?: Array<{
          name?: string;
          displayName?: string;
          description?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      const discovered = (data.models || [])
        .filter((m) => {
          const id = (m.name || '').replace(/^models\//, '');
          const supportsGen =
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent');
          if (!supportsGen) return false;
          if (
            id.includes('embedding') ||
            id.includes('aqa') ||
            id.startsWith('gemini-1.0') ||
            id.startsWith('gemini-pro-vision')
          ) {
            return false;
          }
          return Boolean(id);
        })
        .map((m) => {
          const id = (m.name || '').replace(/^models\//, '');
          return {
            id,
            name: m.displayName || id,
            description: m.description || '',
          };
        });

      const merged = [...discovered];
      for (const fallback of DEFAULT_SERVER_GEMINI_MODELS) {
        if (!merged.some((item) => item.id === fallback.id)) {
          merged.push(fallback);
        }
      }

      res.json({
        models: merged.slice(0, 25),
        message: `Discovered ${merged.length} supported Gemini models from Google API.`,
      });
    } catch {
      res.json({
        models: DEFAULT_SERVER_GEMINI_MODELS,
        message: 'Loaded supported Gemini models.',
      });
    }
  });

  // Connection Test Endpoint for Gemini
  app.post('/api/gemini/test', async (req, res) => {
    const model = resolveGeminiModel(req.body?.model);
    const apiKey = getEffectiveApiKey(req.body?.apiKey);

    if (!apiKey) {
      res.json({
        success: true,
        model,
        simulated: true,
        message: `Server-side Gemini route active (${model}). Operating in onboard simulation mode until GEMINI_API_KEY is set.`,
      });
      return;
    }

    try {
      const ai = getGenAIClient(apiKey);
      const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: 'Respond with "JARVIS online" in 3 words.',
      });
      const reply = (response.text ?? 'JARVIS online').trim();
      res.json({
        success: true,
        model,
        reply,
        message: `Connected to Gemini (${model}). Link verified: "${reply}"`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        success: false,
        error: message,
        message: `Gemini link failed: ${message}`,
      });
    }
  });

  // Standard Generate Content Endpoint for Gemini
  app.post('/api/gemini/generate', async (req, res) => {
    const { prompt, history, systemInstruction, model: requestedModel, apiKey: clientKey } = req.body ?? {};
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }

    const model = resolveGeminiModel(requestedModel);
    const apiKey = getEffectiveApiKey(clientKey);

    if (!apiKey) {
      const fallbackText = getSimulatedJarvisResponse(prompt, getJarvisGreeting());
      res.json({ text: fallbackText, model, simulated: true });
      return;
    }

    const contents = buildContents(history, prompt);

    try {
      const ai = getGenAIClient(apiKey);
      let response: GenerateContentResponse;
      try {
        response = await ai.models.generateContent({
          model,
          contents,
          config: systemInstruction ? { systemInstruction } : undefined,
        });
      } catch (primaryErr) {
        if (model !== 'gemini-flash-latest') {
          response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents,
            config: systemInstruction ? { systemInstruction } : undefined,
          });
        } else {
          throw primaryErr;
        }
      }

      const text = (response.text ?? '').trim();
      if (!text) {
        const fallbackText = getSimulatedJarvisResponse(prompt, getJarvisGreeting());
        res.json({ text: fallbackText, model, simulated: true });
        return;
      }

      res.json({ text, model });
    } catch (_err: unknown) {
      const fallbackText = getSimulatedJarvisResponse(prompt, getJarvisGreeting());
      res.json({ text: fallbackText, model, simulated: true });
    }
  });

  // Streaming Generate Content Endpoint (SSE) for Gemini
  app.post('/api/gemini/stream', async (req, res) => {
    const { prompt, history, systemInstruction, model: requestedModel, apiKey: clientKey } = req.body ?? {};
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }

    const model = resolveGeminiModel(requestedModel);
    const apiKey = getEffectiveApiKey(clientKey);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!apiKey) {
      const fallbackText = getSimulatedJarvisResponse(prompt, getJarvisGreeting());
      res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const contents = buildContents(history, prompt);

    try {
      const ai = getGenAIClient(apiKey);
      const streamResponse = await ai.models.generateContentStream({
        model,
        contents,
        config: systemInstruction
          ? { systemInstruction }
          : undefined,
      });

      for await (const chunk of streamResponse) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          res.write(`data: ${JSON.stringify({ text: c.text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JARVIS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
