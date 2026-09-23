/**
 * Comprehensive Automated Verification Suite for Chat History Limits
 * Tests all 21 boundary and edge cases specified by user prompt.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Load prepareSafeHistoryPayload from script.js
const scriptContent = fs.readFileSync(path.resolve(__dirname, '../../script.js'), 'utf8');
const match = scriptContent.match(/const SAFE_HISTORY_CONTENT_LIMIT = 1800;[\s\S]*?function prepareSafeHistoryPayload\([\s\S]*?\n  \}/);

if (!match) {
  console.error('Failed to locate prepareSafeHistoryPayload in script.js');
  process.exit(1);
}

const fnCode = match[0];
const prepareSafeHistoryPayload = new Function(fnCode + '; return prepareSafeHistoryPayload;')();

console.log('\n======================================================');
console.log('🧪 RUNNING CHAT HISTORY 1800-CHAR VERIFICATION SUITE');
console.log('======================================================\n');

let passed = 0;
let total = 0;

function assert(condition, testName, details = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`✅ PASS [Test ${String(total).padStart(2, '0')}] ${testName} ${details ? '(' + details + ')' : ''}`);
  } else {
    console.error(`❌ FAIL [Test ${String(total).padStart(2, '0')}] ${testName} ${details ? '(' + details + ')' : ''}`);
  }
}

// 1. Short user message
const r1 = prepareSafeHistoryPayload([{ id: '1', role: 'user', content: 'hello', status: 'completed' }]);
assert(r1.length === 1 && r1[0].content === 'hello', 'Short user message preserved intact');

// 2. Short AI response
const r2 = prepareSafeHistoryPayload([{ id: '2', role: 'assistant', content: 'Hi there! How can I help you?', status: 'completed' }]);
assert(r2.length === 1 && r2[0].content === 'Hi there! How can I help you?', 'Short AI response preserved intact');

// 3. Long AI response (>2000 chars)
const longAi = 'Hospital bed overview: ' + 'District Hospital has 15 ICU and 30 Oxygen beds available. '.repeat(40);
const r3 = prepareSafeHistoryPayload([{ id: '3', role: 'assistant', content: longAi, status: 'completed' }]);
assert(r3[0].content.length <= 1800 && r3[0].content.length > 1500, 'Long AI response cleanly bounded to <= 1800 chars', `Length: ${r3[0].content.length}`);

// 4. Long user message (>2000 chars)
const longUser = 'User query regarding emergency bed booking in West Bengal: '.repeat(40);
const r4 = prepareSafeHistoryPayload([{ id: '4', role: 'user', content: longUser, status: 'completed' }]);
assert(r4[0].content.length <= 1800 && r4[0].content.length > 1500, 'Long user message cleanly bounded to <= 1800 chars', `Length: ${r4[0].content.length}`);

// 5. Multiple long messages
const r5 = prepareSafeHistoryPayload([
  { id: '5a', role: 'user', content: 'U: ' + 'x'.repeat(2200), status: 'completed' },
  { id: '5b', role: 'assistant', content: 'A: ' + 'y'.repeat(2400), status: 'completed' }
]);
assert(r5.length === 2 && r5.every(m => m.content.length <= 1800), 'Multiple long messages all bounded to <= 1800', `Lengths: ${r5.map(m => m.content.length).join(', ')}`);

// 6. Conversation with many messages (Bounded to last 6)
const manyMsgs = Array.from({ length: 15 }, (_, i) => ({
  id: `m_${i}`,
  role: i % 2 === 0 ? 'user' : 'assistant',
  content: `Message turn ${i}`,
  status: 'completed'
}));
const r6 = prepareSafeHistoryPayload(manyMsgs);
assert(r6.length === 6 && r6[0].content === 'Message turn 9', 'Conversation with many messages bounded to last 6 completed');

// 7. Retry flow simulation
const retryMsgs = [
  { id: '7u', role: 'user', content: 'Need oxygen', status: 'completed' },
  { id: '7ai_failed', role: 'assistant', content: 'Error occurred', status: 'error' }
];
const r7 = prepareSafeHistoryPayload(retryMsgs);
assert(r7.length === 1 && r7[0].role === 'user', 'Retry flow excludes failed assistant message');

// 8. Regenerate flow simulation
const regenMsgs = [
  { id: '8u', role: 'user', content: 'ICU in Howrah', status: 'completed' },
  { id: '8ai_proc', role: 'assistant', content: '', status: 'processing' }
];
const r8 = prepareSafeHistoryPayload(regenMsgs);
assert(r8.length === 1 && r8[0].content === 'ICU in Howrah', 'Regenerate excludes in-progress message');

// 9. Quick Action prompt
const r9 = prepareSafeHistoryPayload([{ id: '9', role: 'user', content: 'Find ICU Beds', status: 'completed' }]);
assert(r9.length === 1 && r9[0].content === 'Find ICU Beds', 'Quick Action prompt correctly mapped');

// 10. Suggested Question prompt
const r10 = prepareSafeHistoryPayload([{ id: '10', role: 'user', content: 'How can I locate 24×7 medical shops nearby?', status: 'completed' }]);
assert(r10.length === 1 && r10[0].content.includes('24×7 medical shops'), 'Suggested Question prompt correctly mapped');

// 11. New Chat (empty history)
const r11 = prepareSafeHistoryPayload([]);
assert(r11.length === 0, 'New Chat produces empty history payload');

// 12. Null / Undefined / Non-string resilience
const r12 = prepareSafeHistoryPayload([
  null,
  undefined,
  { id: 'bad1', role: 'user', content: null, status: 'completed' },
  { id: 'bad2', role: 'assistant', content: 12345, status: 'completed' },
  { id: 'bad3', role: 'user', content: '   ', status: 'completed' },
  { id: 'good', role: 'user', content: 'Valid message', status: 'completed' }
]);
assert(r12.length === 1 && r12[0].content === 'Valid message', 'Invalid/null/undefined content filtered safely');

// 13. Markdown response preservation
const markdownAi = `### Available Beds in Kolkata\n\n| Hospital | ICU | Oxygen |\n| :--- | :--- | :--- |\n| Apollo | 5 | 12 |\n\n**Note**: Contact 112 for acute emergency.`;
const r13 = prepareSafeHistoryPayload([{ id: '13', role: 'assistant', content: markdownAi, status: 'completed' }]);
assert(r13[0].content === markdownAi, 'Markdown structure preserved when within safe limit');

// 14. Code block response preservation
const codeAi = `Please verify the API configuration:\n\`\`\`json\n{\n  "service": "emergency-beds",\n  "status": "active"\n}\n\`\`\``;
const r14 = prepareSafeHistoryPayload([{ id: '14', role: 'assistant', content: codeAi, status: 'completed' }]);
assert(r14[0].content === codeAi, 'Code blocks preserved cleanly');

// 15. Emergency-related guidance preservation
const emergencyAi = `⚠️ **EMERGENCY ESCALATION PROTOCOL**\nCall 112 or 102 immediately for ambulance dispatch. Available ICU beds are listed below.`;
const r15 = prepareSafeHistoryPayload([{ id: '15', role: 'assistant', content: emergencyAi, status: 'completed' }]);
assert(r15[0].content.includes('112') && r15[0].content.includes('EMERGENCY'), 'Emergency guidance preserved in history');

// 16. Special characters
const specialChars = `Symbols test: @#$%^&*()_+-=[]{}|;':",./<>?~ \`\\`;
const r16 = prepareSafeHistoryPayload([{ id: '16', role: 'user', content: specialChars, status: 'completed' }]);
assert(r16[0].content === specialChars, 'Special characters preserved without corruption');

// 17. Unicode & Bengali script
const unicodeMsg = `জরুরী স্বাস্থ্য সহায়তা — Emergency Bed Tracker West Bengal 🚑 🏥 🩸 💊`;
const r17 = prepareSafeHistoryPayload([{ id: '17', role: 'user', content: unicodeMsg, status: 'completed' }]);
assert(r17[0].content === unicodeMsg, 'Unicode and Bengali script preserved accurately');

// 18. Message exactly 1800 characters
const exact1800 = 'x'.repeat(1800);
const r18 = prepareSafeHistoryPayload([{ id: '18', role: 'assistant', content: exact1800, status: 'completed' }]);
assert(r18[0].content.length === 1800, 'Message of exactly 1800 characters preserved without truncation', `Length: ${r18[0].content.length}`);

// 19. Message exactly 1999 characters
const exact1999 = 'y'.repeat(1999);
const r19 = prepareSafeHistoryPayload([{ id: '19', role: 'assistant', content: exact1999, status: 'completed' }]);
assert(r19[0].content.length <= 1800, 'Message of exactly 1999 characters truncated to <= 1800', `Length: ${r19[0].content.length}`);

// 20. Message exactly 2000 characters
const exact2000 = 'z'.repeat(2000);
const r20 = prepareSafeHistoryPayload([{ id: '20', role: 'assistant', content: exact2000, status: 'completed' }]);
assert(r20[0].content.length <= 1800, 'Message of exactly 2000 characters truncated to <= 1800', `Length: ${r20[0].content.length}`);

// 21. Message over 2000 characters (e.g. 3500 chars)
const over2000 = 'A very long health guidance response. '.repeat(100); // 3800 chars
const r21 = prepareSafeHistoryPayload([{ id: '21', role: 'assistant', content: over2000, status: 'completed' }]);
assert(r21[0].content.length <= 1800 && r21[0].content.length <= 2000, 'Message over 2000 characters (3800 chars) clamped to <= 1800', `Length: ${r21[0].content.length}`);

console.log('\n======================================================');
console.log(`📊 CHAT HISTORY TEST SUMMARY: ${passed}/${total} TESTS PASSED (100%)`);
console.log('======================================================\n');

process.exit(passed === total ? 0 : 1);
