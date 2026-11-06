import { ChatMessage } from '../../types/index.ts';

/**
 * Returns a time-appropriate greeting in JARVIS's British manner.
 */
export function getJarvisGreeting(date: Date = new Date()): string {
  const hour = date.getHours();

  if (hour >= 4 && hour < 12) {
    return 'Good morning, sir.';
  } else if (hour >= 12 && hour < 17) {
    return 'Good afternoon, sir.';
  } else if (hour >= 17 && hour < 22) {
    return 'Good evening, sir.';
  } else {
    return 'Still active, sir? All systems nominal.';
  }
}

/**
 * Constructs the system prompt for the AI provider tailored to the Galaxy Watch 4 circular 40mm screen.
 */
export function buildJarvisSystemPrompt(
  personality: 'stark' | 'tactical' | 'formal' = 'stark',
  customInstructions?: string
): string {
  const baseRules = [
    'You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), personal AI assistant.',
    'You are running directly on a Samsung Galaxy Watch 4 smartwatch (40mm circular display).',
    'Display constraints: Keep all responses exceptionally concise, direct, and readable on a small 396x396 round screen. Maximum 2 to 4 sentences (under 60 words) unless the user explicitly requests an extended briefing.',
    'Tone & Manner: Highly intelligent, polite, calm, confident British assistant.',
    'Address the user respectfully as "sir" periodically, but do not overuse it.',
    'Do not use emojis, markdown headers, or long bulleted lists.',
    'If asked about watch status, telemetry, or hardware, report nominal operations and high efficiency.',
  ];

  if (personality === 'tactical') {
    baseRules.push(
      'Adopt a focused, tactical telemetry tone. Prioritize brevity, actionable data, and situational clarity.'
    );
  } else if (personality === 'formal') {
    baseRules.push(
      'Adopt a classically refined, immaculate British butler manner. Utmost discretion and decorum.'
    );
  } else {
    baseRules.push(
      "Witty, subtle British charm inspired by Tony Stark's chief AI. Confident, helpful, slightly wry when appropriate."
    );
  }

  if (customInstructions && customInstructions.trim().length > 0) {
    baseRules.push(`Additional user-configured directives: ${customInstructions.trim()}`);
  }

  return baseRules.join(' ');
}

/**
 * Formats conversation history into a unified prompt or structured message list.
 */
export function formatConversation(
  history: ChatMessage[],
  newPrompt: string,
  personality: 'stark' | 'tactical' | 'formal' = 'stark',
  customInstructions?: string
) {
  const systemPrompt = buildJarvisSystemPrompt(personality, customInstructions);
  const relevantHistory = history.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  return {
    systemPrompt,
    messages: [...relevantHistory, { role: 'user', content: newPrompt }],
  };
}

/**
 * Intelligent contextual fallback responses when running in local contingency simulation mode.
 */
export function getSimulatedJarvisResponse(prompt: string, greeting: string): string {
  const lower = prompt.toLowerCase();

  if (lower.includes('armor') || lower.includes('mark') || lower.includes('suit')) {
    return `The Mark VII chassis remains in orbital standby, sir. Current power reserves are at 98.4%. Shall I calibrate the repulsor telemetry or prepare a deployment vector?`;
  }

  if (lower.includes('pc') || lower.includes('temperature') || lower.includes('thermal') || lower.includes('cpu')) {
    return `Workstation thermals are well within nominal tolerances, sir. CPU package is holding at 44°C under 18% load, GPU core is at 39°C, and coolant flow remains steady.`;
  }

  if (lower.includes('news') || lower.includes('headline') || lower.includes('briefing')) {
    return `Today's briefing, sir: Global clean-energy grid deployments rose 14% this quarter, orbital satellite arrays report nominal throughput, and semiconductor fabrication indices remain strong.`;
  }

  if (lower.includes('explain') || lower.includes('concept') || lower.includes('simpler')) {
    return `In essence, sir, the system distributes workload across parallel neural pathways while conserving local watch power—delivering immediate wrist-level synthesis without draining the primary cell.`;
  }

  if (lower.includes('status') || lower.includes('system') || lower.includes('diagnostic')) {
    return `${greeting} All Arc Reactor systems are operating at peak 100% capacity. Galaxy Watch 4 core temperature is a cool 31°C, battery level is optimal, and all secure telemetry links remain intact.`;
  }

  if (lower.includes('who are you') || lower.includes('what are you') || lower.includes('introduce')) {
    return `I am J.A.R.V.I.S., your dedicated AI assistant. I have been recompiled for your Samsung Galaxy Watch 4 to provide immediate vocal and tactical intelligence directly on your wrist.`;
  }

  if (lower.includes('weather') || lower.includes('forecast') || lower.includes('rain')) {
    return `Ambient conditions are clear, 21°C with light south-westerly winds at 8 knots. Visibility is optimal across all sectors, sir. No atmospheric anomalies detected.`;
  }

  if (lower.includes('schedule') || lower.includes('calendar') || lower.includes('meeting') || lower.includes('today') || lower.includes('appointment')) {
    return `You have an executive technical review scheduled at 14:00 hours, followed by an interface calibration session at 16:30. Would you like me to adjust your wrist reminders accordingly, sir?`;
  }

  if (lower.includes('time') || lower.includes('clock')) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `The current local time is ${timeStr}, sir. Precision telemetry synchronized with atomic clock standards.`;
  }

  if (lower.includes('battery') || lower.includes('power') || lower.includes('reserve')) {
    return `Power cells are reading 84% nominal. In low-power ambient mode, estimated endurance exceeds 38 hours of continuous operation.`;
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('jarvis') || lower.includes('morning') || lower.includes('evening')) {
    return `${greeting} At your service. Tap the central reactor or speak your query whenever you require assistance.`;
  }

  return `Understood, sir. I have processed "${prompt}". Telemetry channels are active and ready for your next command.`;
}
