import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

const target1 = `    // 3. Upsert the finalized audit with status = 'submitted' (Locked)
    const existCheck = await client.query(\`SELECT id FROM public.audits WHERE case_id = $1\`, [caseId]);`;
const repl1 = `    // 3. Upsert the finalized audit with status = 'submitted' (Locked)
    let realScorecardId = scorecardId;
    if (typeof realScorecardId === "string" && realScorecardId.startsWith("batch_")) {
      const fbScorecard = await client.query("SELECT id FROM public.scorecards WHERE deleted_at IS NULL LIMIT 1");
      if (fbScorecard.rows.length > 0) {
        realScorecardId = fbScorecard.rows[0].id;
      }
    }
    const existCheck = await client.query(\`SELECT id FROM public.audits WHERE case_id = $1\`, [caseId]);`;

content = content.replace(target1, repl1);

const target2 = `      \`, [
        auditId, caseId, scorecardId, auditorId, targetAgentId || null, rawScore, weightedScore, `;
const repl2 = `      \`, [
        auditId, caseId, realScorecardId, auditorId, targetAgentId || null, rawScore, weightedScore, `;

content = content.replace(target2, repl2);

fs.writeFileSync('server.ts', content, 'utf8');
