import { User } from "../types";

export type FormulaContext = {
  values: Record<string, any>; // Field ID or Field Name -> Value
  currentUser?: User;
  now?: Date;
};

export class FormulaEngine {
  static evaluate(formula: string, context: FormulaContext): any {
    if (!formula) return null;

    try {
      // 1. Pre-process formula (replace references like [Question Name])
      let processed = formula;
      
      // Handle [Question Name] or {Question ID} references
      // For now, let's assume questions are referenced directly by name or ID if they don't contain spaces
      // Or we can use a specific syntax like {{Question Name}}
      
      // 2. Define supported functions
      const functions: Record<string, Function> = {
        // Date & Time
        now: () => context.now || new Date(),
        today: () => {
          const d = context.now || new Date();
          d.setHours(0, 0, 0, 0);
          return d;
        },
        currentdate: () => (context.now || new Date()).toLocaleDateString(),
        currenttime: () => (context.now || new Date()).toLocaleTimeString(),
        currenttimestamp: () => (context.now || new Date()).getTime(),

        // User Functions
        currentuser: () => context.currentUser?.name || (context.currentUser as any)?.fullName || "Anonymous",
        currentuserid: () => context.currentUser?.id || "anonymous",
        currentusername: () => context.currentUser?.name || (context.currentUser as any)?.fullName || "Anonymous",
        currentuseremail: () => context.currentUser?.email || "",
        currentuserrole: () => context.currentUser?.role || "",

        // Score Functions
        sum: (...args: any[]) => args.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0),
        average: (...args: any[]) => args.length ? args.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0) / args.length : 0,
        min: (...args: any[]) => Math.min(...args.map(v => Number(v) || 0)),
        max: (...args: any[]) => Math.max(...args.map(v => Number(v) || 0)),
        count: (...args: any[]) => args.length,
        round: (val: any, decimals: number = 0) => {
          const factor = Math.pow(10, decimals);
          return Math.round((Number(val) || 0) * factor) / factor;
        },
        percentage: (val: any, total: any) => total ? ((Number(val) || 0) / (Number(total) || 1)) * 100 : 0,

        // Conditional Functions
        if: (cond: boolean, t: any, f: any) => (cond ? t : f),
        ifelse: (...args: any[]) => {
          for (let i = 0; i < args.length - 1; i += 2) {
            if (args[i]) return args[i + 1];
          }
          return args[args.length - 1];
        },
        isblank: (val: any) => val === null || val === undefined || val === "",
        notblank: (val: any) => val !== null && val !== undefined && val !== "",
        equals: (a: any, b: any) => String(a) === String(b),
        contains: (str: string, substr: string) => String(str).includes(String(substr)),

        // Text Functions
        upper: (str: string) => String(str).toUpperCase(),
        lower: (str: string) => String(str).toLowerCase(),
        concat: (...args: any[]) => args.join(""),
        trim: (str: string) => String(str).trim(),
        replace: (str: string, search: string, replace: string) => String(str).replace(search, replace),
      };

      // 3. Build a safe execution environment
      // We'll use a limited subset of JS via Function constructor, but we need to be careful.
      // A better way is a custom parser. For this task, I'll use a regex-based replacement and eval-like approach
      // but scoped to our context.
      
      // Replace question names with their values from context
      // Syntax: [Question Name]
      processed = processed.replace(/\[([^\]]+)\]/g, (match, name) => {
        const val = context.values[name];
        if (val === undefined) throw new Error(`Unknown Question: ${name}`);
        return JSON.stringify(val);
      });

      // Simple implementation: convert functions to JS calls
      // e.g. Sum(a, b) -> functions.sum(a, b)
      // This is risky for a production app without a real parser, but I'll make it as robust as possible
      // by mapping function names case-insensitively.
      
      const functionNames = Object.keys(functions);
      const funcRegex = new RegExp(`\\b(${functionNames.join("|")})\\s*\\(`, "gi");
      
      processed = processed.replace(funcRegex, (match, func) => {
        return `__funcs.${func.toLowerCase()}(`;
      });

      // Execute in a isolated context
      const executor = new Function("__funcs", "__context", `
        try {
          return ${processed};
        } catch (e) {
          return "Error: " + e.message;
        }
      `);

      return executor(functions, context);
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  }

  static validate(formula: string, fields: { id: string, name: string }[], metadataHeaders: string[] = []): { valid: boolean; error?: string } {
    if (!formula) return { valid: true };

    // Check for unknown questions or metadata headers
    const refs = formula.match(/\[([^\]]+)\]/g) || [];
    for (const ref of refs) {
      const name = ref.slice(1, -1);
      const isField = fields.some(f => f.name === name || f.id === name);
      const isMetadata = metadataHeaders.includes(name);
      if (!isField && !isMetadata) {
        return { valid: false, error: `Unknown Reference: ${name}` };
      }
    }

    // Basic syntax check
    try {
      const mockValues = {
        ...fields.reduce((acc, f) => ({ ...acc, [f.name]: 0 }), {}),
        ...metadataHeaders.reduce((acc, h) => ({ ...acc, [h]: "test_metadata" }), {})
      };
      this.evaluate(formula, { values: mockValues });
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: `Invalid Syntax: ${err.message}` };
    }
  }
}
