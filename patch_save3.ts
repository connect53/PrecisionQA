import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

const target1 = `    const existCheck = await db.query(\`SELECT id FROM public.audits WHERE case_id = $1\`, [caseId]);`;
const repl1 = `    // Fetch agent_id from case if not provided
    let finalAgentId = agentId;
    if (!finalAgentId) {
      const caseRes = await db.query(\`SELECT agent_id FROM public.audit_cases WHERE id = $1\`, [caseId]);
      if (caseRes.rows.length > 0 && caseRes.rows[0].agent_id) {
        finalAgentId = caseRes.rows[0].agent_id;
      }
    }
    finalAgentId = finalAgentId || '00000000-0000-0000-0000-000000000001';
    
    const existCheck = await db.query(\`SELECT id FROM public.audits WHERE case_id = $1\`, [caseId]);`;

content = content.replace(target1, repl1);

// Fix target 2
const target2 = `        generalComments || "", coachingNotes || "", status, auditorId, agentId || null, auditId
      ]);`;
const repl2 = `        generalComments || "", coachingNotes || "", status, auditorId, finalAgentId, auditId
      ]);`;
content = content.replace(target2, repl2);

const target3 = `        auditId, caseId, realScorecardId, auditorId, agentId || null, rawScore || 0, weightedScore || 0, `;
const repl3 = `        auditId, caseId, realScorecardId, auditorId, finalAgentId, rawScore || 0, weightedScore || 0, `;
content = content.replace(target3, repl3);

fs.writeFileSync('server.ts', content, 'utf8');
