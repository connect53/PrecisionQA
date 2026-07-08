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

const target2 = `        generalComments || "", coachingNotes || "", status, auditorId, agentId || null, auditId
      ]);
    } else {
      auditId = crypto.randomUUID();
      await db.query(\`
        INSERT INTO public.audits (
          id, case_id, scorecard_id, auditorId, agent_id, raw_score, weighted_score, 
          status, is_critical_failed, answers, general_comments, coaching_notes, created_at, updated_at
        )`; // wait, target2 was a bit different. Let's do it safer.

