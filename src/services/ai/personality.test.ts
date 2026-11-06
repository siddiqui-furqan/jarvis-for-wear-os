import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getJarvisGreeting,
  buildJarvisSystemPrompt,
  getSimulatedJarvisResponse,
  formatConversation,
} from './personality.ts';
import { deriveAdaptiveSuggestions } from './suggestions.ts';

test('getJarvisGreeting returns correct greeting by hour', () => {
  const morning = new Date(2026, 10, 1, 8, 30);
  assert.equal(getJarvisGreeting(morning), 'Good morning, sir.');

  const afternoon = new Date(2026, 10, 1, 14, 0);
  assert.equal(getJarvisGreeting(afternoon), 'Good afternoon, sir.');

  const evening = new Date(2026, 10, 1, 19, 45);
  assert.equal(getJarvisGreeting(evening), 'Good evening, sir.');

  const night = new Date(2026, 10, 1, 23, 15);
  assert.equal(getJarvisGreeting(night), 'Still active, sir? All systems nominal.');
});

test('buildJarvisSystemPrompt emphasizes Galaxy Watch 4 circular 40mm constraints and custom instructions', () => {
  const prompt = buildJarvisSystemPrompt('stark', 'Always report metrics in metric units.');
  assert.match(prompt, /Samsung Galaxy Watch 4/);
  assert.match(prompt, /396x396/);
  assert.match(prompt, /concise/i);
  assert.match(prompt, /Always report metrics in metric units/);
});

test('getSimulatedJarvisResponse answers status and suit queries smoothly', () => {
  const statusRes = getSimulatedJarvisResponse('What is the system status?', 'Good evening, sir.');
  assert.match(statusRes, /Arc Reactor systems/);
  assert.match(statusRes, /Galaxy Watch 4/);

  const armorRes = getSimulatedJarvisResponse('Mark VII armor status', 'Good evening, sir.');
  assert.match(armorRes, /Mark VII/);
});

test('formatConversation correctly maps messages and applies system prompt', () => {
  const formatted = formatConversation(
    [{ id: '1', role: 'user', content: 'Hello', timestamp: 123 }],
    'What time is it?',
    'formal'
  );
  assert.equal(formatted.messages.length, 2);
  assert.equal(formatted.messages[1].content, 'What time is it?');
  assert.match(formatted.systemPrompt, /discretion and decorum/);
});

test('deriveAdaptiveSuggestions returns fallbacks when history has no user turns', () => {
  const suggestions = deriveAdaptiveSuggestions(
    [{ id: 'w1', role: 'assistant', content: 'At your service, sir.', timestamp: 100 }],
    [],
    2
  );
  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0].label, 'Check my PC temperatures');
  assert.equal(suggestions[1].label, "Summarise today's news");
});

test('deriveAdaptiveSuggestions adapts to conversation patterns and respects dismissed items', () => {
  const history = [
    { id: 'u1', role: 'user' as const, content: 'What is my schedule for today?', timestamp: 100 },
    { id: 'a1', role: 'assistant' as const, content: 'You have a review at 14:00.', timestamp: 200 },
  ];
  const active = deriveAdaptiveSuggestions(history, [], 2);
  assert.equal(active.length, 2);
  assert.equal(active[0].label, 'Check next appointment');

  const afterDismiss = deriveAdaptiveSuggestions(history, [active[0].id], 2);
  assert.notEqual(afterDismiss[0].id, active[0].id);
});
