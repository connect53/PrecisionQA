import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

const target1 = `    const targetAgentId = agentId || caseRes.rows[0].agentId;`;
const repl1 = `    const targetAgentId = agentId || caseRes.rows[0].agentId || '00000000-0000-0000-0000-000000000001';`;

content = content.replace(target1, repl1);

const target2 = `generalComments, coachingNotes, auditorId, targetAgentId || null, durationSeconds || 0, auditId`;
const repl2 = `generalComments, coachingNotes, auditorId, targetAgentId, durationSeconds || 0, auditId`;
content = content.replace(target2, repl2);

const target3 = `auditId, caseId, realScorecardId, auditorId, targetAgentId || null, rawScore, weightedScore,`;
const repl3 = `auditId, caseId, realScorecardId, auditorId, targetAgentId, rawScore, weightedScore,`;
content = content.replace(target3, repl3);

fs.writeFileSync('server.ts', content, 'utf8');
