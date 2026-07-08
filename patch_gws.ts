import fs from 'fs';
let content = fs.readFileSync('src/lib/googleWorkspace.ts', 'utf8');

const target1 = `    if (!res.ok) {
      throw new Error(\`Failed to list spreadsheets: \${res.statusText}\`);
    }`;
const repl1 = `    if (!res.ok) {
      const errText = await res.text();
      throw new Error(\`Failed to list spreadsheets: \${res.statusText} - \${errText}\`);
    }`;
content = content.replace(target1, repl1);

const target2 = `    if (!res.ok) {
      throw new Error(\`Failed to get spreadsheet details: \${res.statusText}\`);
    }`;
const repl2 = `    if (!res.ok) {
      const errText = await res.text();
      throw new Error(\`Failed to get spreadsheet details: \${res.statusText} - \${errText}\`);
    }`;
content = content.replace(target2, repl2);

const target3 = `    if (!res.ok) {
      throw new Error(\`Failed to read sheet data: \${res.statusText}\`);
    }`;
const repl3 = `    if (!res.ok) {
      const errText = await res.text();
      throw new Error(\`Failed to read sheet data: \${res.statusText} - \${errText}\`);
    }`;
content = content.replace(target3, repl3);

fs.writeFileSync('src/lib/googleWorkspace.ts', content, 'utf8');
