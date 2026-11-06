import { AdaptiveSuggestion, ChatMessage } from '../../types/index.ts';

const FALLBACK_SUGGESTIONS: AdaptiveSuggestion[] = [
  {
    id: 'fallback-pc-temp',
    label: 'Check my PC temperatures',
    prompt: 'Check my PC temperatures and thermal status',
    reason: 'fallback',
  },
  {
    id: 'fallback-news',
    label: "Summarise today's news",
    prompt: "Summarise today's key technology and world news",
    reason: 'fallback',
  },
  {
    id: 'fallback-concept',
    label: 'Explain this concept again',
    prompt: 'Explain the previous concept again in simpler terms',
    reason: 'fallback',
  },
  {
    id: 'fallback-schedule',
    label: 'Review upcoming schedule',
    prompt: 'What is on my schedule for the rest of today?',
    reason: 'fallback',
  },
  {
    id: 'fallback-diagnostics',
    label: 'Run watch diagnostics',
    prompt: 'Run a diagnostic check on all watch systems',
    reason: 'fallback',
  },
];

interface TopicPattern {
  id: string;
  keywords: string[];
  followupLabel: string;
  followupPrompt: string;
}

const TOPIC_PATTERNS: TopicPattern[] = [
  {
    id: 'topic-pc-hardware',
    keywords: ['pc', 'temperature', 'thermal', 'cpu', 'gpu', 'core', 'temp'],
    followupLabel: 'Check my PC temperatures',
    followupPrompt: 'Check my PC temperatures and core load',
  },
  {
    id: 'topic-news-briefing',
    keywords: ['news', 'headline', 'briefing', 'world', 'update', 'summary'],
    followupLabel: "Summarise today's news",
    followupPrompt: "Summarise today's top news headlines concisely",
  },
  {
    id: 'topic-explain-followup',
    keywords: ['explain', 'concept', 'how does', 'elaborate', 'quantum', 'theory', 'architecture'],
    followupLabel: 'Explain this concept again',
    followupPrompt: 'Explain this concept again more concisely, sir',
  },
  {
    id: 'topic-schedule-agenda',
    keywords: ['schedule', 'calendar', 'meeting', 'agenda', 'today', 'reminder', 'appointment'],
    followupLabel: 'Check next appointment',
    followupPrompt: 'When is my next scheduled meeting or reminder?',
  },
  {
    id: 'topic-weather-atmosphere',
    keywords: ['weather', 'forecast', 'rain', 'wind', 'atmospheric', 'outside'],
    followupLabel: 'Update weather forecast',
    followupPrompt: 'Give me an updated local weather forecast',
  },
  {
    id: 'topic-diagnostics-power',
    keywords: ['status', 'diagnostic', 'battery', 'power', 'reactor', 'system', 'armor', 'mark'],
    followupLabel: 'Verify power reserves',
    followupPrompt: 'Verify current power reserves and system status',
  },
];

function truncateLabel(text: string, maxLen = 26): string {
  const clean = text.replace(/[?.!]+$/, '').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1).trim() + '…';
}

/**
 * Generates 2 to 3 adaptive suggestions strictly locally from the user's conversation history.
 * Weights recent queries higher while tracking recurring topics and excluding dismissed items.
 */
export function deriveAdaptiveSuggestions(
  messages: ChatMessage[],
  dismissedIds: string[] = [],
  maxSuggestions = 2
): AdaptiveSuggestion[] {
  const dismissedSet = new Set(dismissedIds);
  const userMessages = messages.filter((m) => m.role === 'user' && m.content.trim().length > 0);

  const candidates: Array<{ suggestion: AdaptiveSuggestion; score: number }> = [];
  const seenLabels = new Set<string>();

  if (userMessages.length > 0) {
    // 1. Score topic patterns with recency + frequency weighting
    const patternScores = new Map<string, { count: number; recencyBoost: number; pattern: TopicPattern }>();

    userMessages.forEach((msg, idx) => {
      const lower = msg.content.toLowerCase();
      // Recency weight: most recent message gets highest weight
      const recencyWeight = 1 + ((idx + 1) / userMessages.length) * 2.0;

      for (const pattern of TOPIC_PATTERNS) {
        if (pattern.keywords.some((kw) => lower.includes(kw))) {
          const existing = patternScores.get(pattern.id);
          if (existing) {
            existing.count += 1;
            existing.recencyBoost = Math.max(existing.recencyBoost, recencyWeight);
          } else {
            patternScores.set(pattern.id, {
              count: 1,
              recencyBoost: recencyWeight,
              pattern,
            });
          }
        }
      }
    });

    for (const [id, entry] of patternScores.entries()) {
      if (dismissedSet.has(id)) continue;
      const totalScore = entry.count * 1.5 + entry.recencyBoost * 2.0;
      const labelKey = entry.pattern.followupLabel.toLowerCase();
      if (!seenLabels.has(labelKey)) {
        seenLabels.add(labelKey);
        candidates.push({
          score: totalScore,
          suggestion: {
            id,
            label: truncateLabel(entry.pattern.followupLabel),
            prompt: entry.pattern.followupPrompt,
            reason: entry.count > 1 ? 'frequent' : 'recent',
          },
        });
      }
    }

    // 2. Also surface contextual follow-up if the last message was an assistant response
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && !dismissedSet.has('followup-elaborate')) {
      const followupLabel = 'Explain this concept again';
      if (!seenLabels.has(followupLabel.toLowerCase())) {
        seenLabels.add(followupLabel.toLowerCase());
        candidates.push({
          score: 3.2,
          suggestion: {
            id: 'followup-elaborate',
            label: followupLabel,
            prompt: 'Could you explain that last point again concisely?',
            reason: 'followup',
          },
        });
      }
    }

    // 3. Direct frequent/recent custom user query recall (if user typed a custom phrase not covered above)
    const lastUserMsg = userMessages[userMessages.length - 1];
    if (lastUserMsg) {
      const customId = `custom-${lastUserMsg.content.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}`;
      const shortLabel = truncateLabel(lastUserMsg.content, 25);
      if (!dismissedSet.has(customId) && !seenLabels.has(shortLabel.toLowerCase())) {
        seenLabels.add(shortLabel.toLowerCase());
        candidates.push({
          score: 2.8,
          suggestion: {
            id: customId,
            label: shortLabel,
            prompt: lastUserMsg.content,
            reason: 'recent',
          },
        });
      }
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  const result = candidates.slice(0, maxSuggestions).map((c) => c.suggestion);

  // Fill remaining slots from fallback pool (excluding dismissed and already used labels)
  for (const fb of FALLBACK_SUGGESTIONS) {
    if (result.length >= maxSuggestions) break;
    if (dismissedSet.has(fb.id)) continue;
    const lbl = (fb.label ?? fb.shortLabel ?? '').toLowerCase();
    if (seenLabels.has(lbl)) continue;
    seenLabels.add(lbl);
    result.push(fb);
  }

  return result;
}
