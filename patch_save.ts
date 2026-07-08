import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

const target1 = `  try {
    const existCheck = await db.query(\`SELECT id FROM public.audits WHERE case_id = $1\`, [caseId]);`;
const repl1 = `  try {
    let realScorecardId = scorecardId;
    if (typeof realScorecardId === "string" && realScorecardId.startsWith("batch_")) {
      const fbScorecard = await db.query("SELECT id FROM public.scorecards WHERE deleted_at IS NULL LIMIT 1");
      if (fbScorecard.rows.length > 0) {
        realScorecardId = fbScorecard.rows[0].id;
      }
    }
    const existCheck = await db.query(\`SELECT id FROM public.audits WHERE case_id = $1\`, [caseId]);`;

content = content.replace(target1, repl1);

const target2 = `        auditId, caseId, scorecardId, auditorId, agentId || null, rawScore || 0, weightedScore || 0, `;
const repl2 = `        auditId, caseId, realScorecardId, auditorId, agentId || null, rawScore || 0, weightedScore || 0, `;

content = content.replace(target2, repl2);

fs.writeFileSync('server.ts', content, 'utf8');
