export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  description: string;
  code?: string;
}

export interface DbTable {
  name: string;
  description: string;
  columns: {
    name: string;
    type: string;
    constraints?: string;
    description: string;
  }[];
  rlsPolicies: string[];
  sql: string;
}

export interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  headers: string[];
  requestBody?: string;
  responseBody: string;
  zodSchema: string;
}

export const architectureData = {
  appName: "PrecisionQA",
  parentPlatform: "Precision360",
  techStack: [
    { name: "Next.js (App Router)", description: "React Framework with Server Components and API routing", version: "15.x" },
    { name: "Supabase", description: "Database (Postgres), Auth, Storage, and Realtime capabilities", version: "Latest" },
    { name: "Google Gemini API", description: "Server-side analysis, QA transcription scanning, and AI feedback", version: "@google/genai ^2.4.0" },
    { name: "shadcn/ui", description: "Accessible UI component primitives styled with Tailwind CSS", version: "Radix UI based" },
    { name: "TypeScript", description: "Strict static type-checking for application safety", version: "5.x" },
    { name: "Tailwind CSS", description: "Utility-first CSS styling including custom theme variables", version: "4.x" },
    { name: "TanStack Table", description: "Headless grid engine for high-performance sorting & pagination", version: "v8" },
    { name: "Zod & React Hook Form", description: "Schema-based form validation and performance form rendering", version: "Strict" },
    { name: "Recharts", description: "Responsive D3-backed visual analytics dashboard modules", version: "Latest" }
  ],
  folderTree: {
    name: "precision360-monorepo",
    type: "folder" as const,
    description: "Enterprise-grade root directory architecture supporting multi-module scaling.",
    children: [
      {
        name: ".env.example",
        type: "file" as const,
        description: "Standardized environment variables structure with secrets documented.",
        code: `# NEXT.JS PUBLIC VARIABLES (Exposed to Client)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsIn..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# SERVER-ONLY SECRETS (Never exposed to browser)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
GEMINI_API_KEY="AIzaSyA..."
JWT_SECRET="super-secret-jwt-key"

# MODULE TOGGLES (Scalability for future rollouts)
ENABLE_MODULE_QA=true
ENABLE_MODULE_ATTENDANCE=false
ENABLE_MODULE_PERFORMANCE=false
ENABLE_MODULE_COACHING=false`
      },
      {
        name: "supabase",
        type: "folder" as const,
        description: "Supabase DB configurations, seed scripts, and Postgres RLS migrations.",
        children: [
          {
            name: "migrations",
            type: "folder" as const,
            description: "Database Version Control scripts for instant spin-up of development / production DBs.",
            children: [
              {
                name: "20260703000000_init_precision_qa.sql",
                type: "file" as const,
                description: "Primary database migration specifying schemas, tables, relationships, and RLS policies.",
                code: `-- Setup schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS qa;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core Users Table (Synchronized with Auth Users)
CREATE TABLE core.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Agent', 'QA_Analyst', 'Supervisor', 'Administrator')),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- QA Evaluation Templates (Dynamic Quality Scorecards)
CREATE TABLE qa.templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL, -- Nested criteria weights, categories, & thresholds
    is_active BOOLEAN DEFAULT true NOT NULL,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES core.users(id)
);

-- QA Evaluations (Scorecards populated by QA Analysts)
CREATE TABLE qa.evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES qa.templates(id) ON DELETE RESTRICT,
    agent_id UUID REFERENCES core.users(id) ON DELETE CASCADE,
    evaluator_id UUID REFERENCES core.users(id) ON DELETE RESTRICT,
    call_id VARCHAR(100) NOT NULL, -- Call record identifier
    audio_url TEXT, -- Call recording storage reference
    scores JSONB NOT NULL, -- Actual scores given per criteria item
    final_score NUMERIC(5,2) NOT NULL, -- Computed average weight-score (0-100)
    agent_feedback TEXT,
    status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Disputed', 'Resolved')),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- AI Insights & Auto-Feedback (Powered by Google Gemini API)
CREATE TABLE qa.ai_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID REFERENCES qa.evaluations(id) ON DELETE CASCADE,
    transcription TEXT,
    sentiment_score NUMERIC(3,2), -- Sentiment analysis output
    auto_suggestions JSONB, -- AI-powered growth recommendation bullet points
    compliance_flags JSONB, -- Missed compliance points detected
    model_version VARCHAR(100) DEFAULT 'gemini-2.5-flash' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa.ai_feedback ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY "Users can only read tenant-specific users" ON core.users
    FOR SELECT USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "QA Analysts can manage tenant-specific evaluations" ON qa.evaluations
    FOR ALL USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Agents can only read their own evaluations" ON qa.evaluations
    FOR SELECT USING (agent_id = auth.uid());`
              }
            ]
          }
        ]
      },
      {
        name: "src",
        type: "folder" as const,
        description: "Application source code directory containing modular subfolders.",
        children: [
          {
            name: "app",
            type: "folder" as const,
            description: "Next.js App Router folders containing layouts, pages, and server-side route endpoints.",
            children: [
              {
                name: "api",
                type: "folder" as const,
                description: "Secure Backend API endpoints which proxy key-restricted calls to Supabase or Gemini.",
                children: [
                  {
                    name: "qa",
                    type: "folder" as const,
                    description: "RESTful JSON endpoints mapping to PrecisionQA logical operations.",
                    children: [
                      {
                        name: "evaluations",
                        type: "folder" as const,
                        description: "Evaluations resource directory.",
                        children: [
                          {
                            name: "route.ts",
                            type: "file" as const,
                            description: "API route endpoint implementing evaluation submission, authorization, and Zod validation.",
                            code: `import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { GoogleGenAI } from '@google/genai';
import { evaluationSchema } from '@/src/types/schemas';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// POST /api/qa/evaluations - Create evaluation + trigger Gemini assessment
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (cookiesToSet) => {} } }
  );

  // 1. Authenticate Requesting User
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized User' }, { status: 401 });
  }

  // 2. Validate Request Body payload
  const body = await request.json();
  const parsed = evaluationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Payload', details: parsed.error.format() }, { status: 400 });
  }

  const payload = parsed.data;

  try {
    // 3. Database Transaction via Supabase REST RPC or client
    const { data: evaluation, error: insertError } = await supabase
      .from('qa.evaluations')
      .insert({
        template_id: payload.templateId,
        agent_id: payload.agentId,
        evaluator_id: user.id,
        call_id: payload.callId,
        scores: payload.scores,
        final_score: payload.finalScore,
        tenant_id: user.user_metadata.tenant_id,
        status: 'Draft'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 4. Background AI Audit using Gemini
    // We send compliance checklists & scores to generate actionable growth feedback
    if (payload.transcriptText) {
      const prompt = \`
        Analyze this customer support call transcript against our Evaluation Score: \${payload.finalScore}/100.
        Criteria Evaluated: \${JSON.stringify(payload.scores)}
        
        Transcript: "\${payload.transcriptText}"
        
        Provide high-value structured feedback in JSON format conforming exactly to:
        {
          "sentiment_score": number (0.0 to 1.0),
          "auto_suggestions": string[],
          "compliance_flags": string[]
        }
      \`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const aiData = JSON.parse(aiResponse.text);

      // Save Insights linked to Evaluation
      await supabase.from('qa.ai_feedback').insert({
        evaluation_id: evaluation.id,
        transcription: payload.transcriptText,
        sentiment_score: aiData.sentiment_score,
        auto_suggestions: aiData.auto_suggestions,
        compliance_flags: aiData.compliance_flags
      });
    }

    return NextResponse.json({ success: true, evaluationId: evaluation.id }, { status: 201 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}`
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                name: "(dashboard)",
                type: "folder" as const,
                description: "Authenticated Route Group guaranteeing layout consistency across pages.",
                children: [
                  {
                    name: "qa",
                    type: "folder" as const,
                    description: "Main PrecisionQA Dashboard Directory.",
                    children: [
                      {
                        name: "page.tsx",
                        type: "file" as const,
                        description: "Dashboard entry point. Queries evaluations statistics, renders charts, and streams listing records.",
                        code: `import React, { Suspense } from 'react';
import EvaluationStats from '@/src/components/features/qa/EvaluationStats';
import EvaluationListTable from '@/src/components/features/qa/EvaluationListTable';
import LoadingSkeleton from '@/src/components/ui/LoadingSkeleton';

export default async function QADashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">PrecisionQA</h1>
        <p className="text-sm text-slate-500">Analyze team performance, audit transcripts, and deliver smart AI coaching.</p>
      </div>

      {/* High-Performance Analytics Blocks */}
      <Suspense fallback={<LoadingSkeleton count={4} />}>
        <EvaluationStats />
      </Suspense>

      {/* Datatable Wrapper */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-950">Evaluation Records</h3>
            <p className="text-xs text-slate-500">Track current scorecard reviews and disputation states.</p>
          </div>
        </div>
        <Suspense fallback={<LoadingSkeleton count={8} />}>
          <EvaluationListTable />
        </Suspense>
      </div>
    </div>
  );
}`
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            name: "components",
            type: "folder" as const,
            description: "Reusable modular components subdivided into layout, atomic UI and rich features.",
            children: [
              {
                name: "ui",
                type: "folder" as const,
                description: "Accessible, pure UI component library matching shadcn principles.",
                children: [
                  {
                    name: "table.tsx",
                    type: "file" as const,
                    description: "Table rendering layout component using clean Tailwind styles.",
                    code: `import * as React from "react";
import { cn } from "@/src/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  )
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b bg-slate-50/70", className)} {...props} />
  )
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  )
);
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("border-b transition-colors hover:bg-slate-50/50 data-[state=selected]:bg-muted", className)} {...props} />
  )
);
TableRow.displayName = "TableRow";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  )
);
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableCell };`
                  },
                  {
                    name: "card.tsx",
                    type: "file" as const,
                    description: "Structured card frames supporting high-contrast headers, bodies, and visual rhythm.",
                    code: `import * as React from "react";
import { cn } from "@/src/lib/utils";

export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-xl border border-slate-200/60 bg-white shadow-sm", className)} {...props} />
);

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("font-semibold leading-none tracking-tight text-slate-900", className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
);`
                  }
                ]
              },
              {
                name: "features",
                type: "folder" as const,
                description: "Logic-heavy, module-specific dashboard panels and analytical views.",
                children: [
                  {
                    name: "qa",
                    type: "folder" as const,
                    description: "PrecisionQA Feature Components directory.",
                    children: [
                      {
                        name: "EvaluationForm.tsx",
                        type: "file" as const,
                        description: "Rich scorecard entry form utilizing React Hook Form + Zod verification.",
                        code: `import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { evaluationSchema, type EvaluationInput } from '@/src/types/schemas';

interface Props {
  onSubmit: (data: EvaluationInput) => Promise<void>;
  agents: { id: string; name: string }[];
  templates: { id: string; title: string; criteria: any }[];
}

export default function EvaluationForm({ onSubmit, agents, templates }: Props) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<EvaluationInput>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: { finalScore: 0, scores: {} }
  });

  const handleFormSubmit = async (data: EvaluationInput) => {
    setLoading(true);
    try {
      await onSubmit(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Select Agent</label>
          <select {...register('agentId')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-950">
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {errors.agentId && <p className="text-xs text-red-500">{errors.agentId.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Call Record Reference ID</label>
          <input type="text" {...register('callId')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-950" placeholder="e.g., CALL-984712" />
          {errors.callId && <p className="text-xs text-red-500">{errors.callId.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-600">Audio Transcription / Call Notes</label>
        <textarea {...register('transcriptText')} rows={6} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-950" placeholder="Paste full recording transcript text here..." />
      </div>

      <button type="submit" disabled={loading} className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50">
        {loading ? 'Submitting & Running AI Audit...' : 'Publish Scorecard'}
      </button>
    </form>
  );
}`
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            name: "lib",
            type: "folder" as const,
            description: "Helper scripts, utility integrations, and reusable platform clients.",
            children: [
              {
                name: "supabase",
                type: "folder" as const,
                description: "Isomorphic configuration client handlers protecting and streamlining Supabase auth status.",
                children: [
                  {
                    name: "client.ts",
                    type: "file" as const,
                    description: "Browser-side environment database client helper.",
                    code: `import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}`
                  },
                  {
                    name: "server.ts",
                    type: "file" as const,
                    description: "Next.js server-side Client cookie synchronization engine.",
                    code: `import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Safe fallback when routing occurs from Server Components
          }
        },
      },
    }
  );
}`
                  }
                ]
              },
              {
                name: "utils.ts",
                type: "file" as const,
                description: "Shared helper routines including tailwind merger configurations.",
                code: `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(score);
}

export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  if (score >= 75) return 'text-amber-600 bg-amber-50 border-amber-100';
  return 'text-red-600 bg-red-50 border-red-100';
}`
              }
            ]
          },
          {
            name: "types",
            type: "folder" as const,
            description: "Strict schemas definitions, typescript contracts, and zod structures.",
            children: [
              {
                name: "index.ts",
                type: "file" as const,
                description: "Centralized TypeScript interface registry representing core entities.",
                code: `export type UserRole = 'Agent' | 'QA_Analyst' | 'Supervisor' | 'Administrator';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  tenantId: string;
  createdAt: string;
}

export interface EvaluationTemplate {
  id: string;
  title: string;
  description?: string;
  criteria: Record<string, { weight: number; label: string; description: string }>;
  isActive: boolean;
}

export interface Evaluation {
  id: string;
  templateId: string;
  agentId: string;
  evaluatorId: string;
  callId: string;
  scores: Record<string, number>; // criteriaId: score (0-100)
  finalScore: number;
  agentFeedback?: string;
  status: 'Draft' | 'Published' | 'Disputed' | 'Resolved';
  createdAt: string;
  updatedAt: string;
}

export interface AiFeedback {
  id: string;
  evaluationId: string;
  transcription?: string;
  sentimentScore: number;
  autoSuggestions: string[];
  complianceFlags: string[];
  createdAt: string;
}`
              },
              {
                name: "schemas.ts",
                type: "file" as const,
                description: "Zod validators mapping strict input rules. Fully ready for Server Actions or route payload filters.",
                code: `import { z } from 'zod';

export const evaluationSchema = z.object({
  templateId: z.string().uuid({ message: 'A valid Quality Scorecard Template must be selected' }),
  agentId: z.string().uuid({ message: 'Evaluation must be assigned to an Agent' }),
  callId: z.string().min(3, { message: 'Reference Call ID is required' }),
  scores: z.record(z.string(), z.number().min(0).max(100)),
  finalScore: z.number().min(0).max(100),
  transcriptText: z.string().optional()
});

export type EvaluationInput = z.infer<typeof evaluationSchema>;`
              }
            ]
          },
          {
            name: "store",
            type: "folder" as const,
            description: "State management directory holding client state managers like Zustand stores.",
            children: [
              {
                name: "qaStore.ts",
                type: "file" as const,
                description: "Zustand Client Store tracking interactive filter parameters and active selections.",
                code: `import { create } from 'zustand';

interface QAState {
  filterAgentId: string | null;
  filterStatus: string | null;
  searchQuery: string;
  selectedEvaluationId: string | null;
  setFilters: (filters: Partial<Omit<QAState, 'setFilters' | 'reset'>>) => void;
  reset: () => void;
}

export const useQAStore = create<QAState>((set) => ({
  filterAgentId: null,
  filterStatus: null,
  searchQuery: '',
  selectedEvaluationId: null,
  setFilters: (filters) => set((state) => ({ ...state, ...filters })),
  reset: () => set({ filterAgentId: null, filterStatus: null, searchQuery: '', selectedEvaluationId: null })
}));`
              }
            ]
          }
        ]
      }
    ]
  },
  dbSchema: [
    {
      name: "core.users",
      description: "Stores profiles for employees, syncing with auth.users via triggers. Isolated by tenant_id.",
      columns: [
        { name: "id", type: "UUID (PK)", constraints: "REFERENCES auth.users(id)", description: "Unique identifier matching the Auth layer user." },
        { name: "email", type: "VARCHAR(255)", constraints: "UNIQUE, NOT NULL", description: "Business email address." },
        { name: "full_name", type: "VARCHAR(255)", constraints: "NOT NULL", description: "Display name of employee." },
        { name: "role", type: "VARCHAR(50)", constraints: "CHECK (role IN ('Agent', 'QA_Analyst', 'Supervisor', 'Administrator'))", description: "System role controlling dashboard dashboard filters and routing capabilities." },
        { name: "tenant_id", type: "UUID", constraints: "NOT NULL", description: "Identifies multi-tenant enterprise partition." }
      ],
      rlsPolicies: [
        "SELECT: Only view users who share the exact same 'tenant_id' as matching in JWT claims.",
        "UPDATE: Only Administrator profiles inside the same tenant can update user details."
      ],
      sql: `CREATE TABLE core.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Agent', 'QA_Analyst', 'Supervisor', 'Administrator')),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);`
    },
    {
      name: "qa.evaluations",
      description: "Scores records evaluating call record standards against customizable scoring rubrics.",
      columns: [
        { name: "id", type: "UUID (PK)", constraints: "DEFAULT uuid_generate_v4()", description: "Primary Key." },
        { name: "template_id", type: "UUID (FK)", constraints: "REFERENCES qa.templates(id)", description: "Scorecard Criteria weight blueprint used." },
        { name: "agent_id", type: "UUID (FK)", constraints: "REFERENCES core.users(id)", description: "The agent whose performance is being audited." },
        { name: "evaluator_id", type: "UUID (FK)", constraints: "REFERENCES core.users(id)", description: "The QA analyst carrying out the scorecard." },
        { name: "call_id", type: "VARCHAR(100)", constraints: "NOT NULL", description: "Reference tracking string to recording server." },
        { name: "scores", type: "JSONB", constraints: "NOT NULL", description: "Key-value pair map of specific metrics scored, e.g. { 'empathy': 90, 'greeting': 100 }." },
        { name: "final_score", type: "NUMERIC(5,2)", constraints: "NOT NULL", description: "Weighted average total quality performance score." },
        { name: "status", type: "VARCHAR(50)", constraints: "CHECK (status IN ('Draft', 'Published', 'Disputed', 'Resolved'))", description: "Workflow state of the scorecard record." }
      ],
      rlsPolicies: [
        "SELECT (Agent): Can view only scorecards where 'agent_id' equals their logged-in auth.uid() and status is 'Published'.",
        "ALL (QA Analyst): Full management rights to scorecards inside their specific enterprise 'tenant_id'."
      ],
      sql: `CREATE TABLE qa.evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES qa.templates(id),
  agent_id UUID REFERENCES core.users(id),
  evaluator_id UUID REFERENCES core.users(id),
  call_id VARCHAR(100) NOT NULL,
  scores JSONB NOT NULL,
  final_score NUMERIC(5,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'Draft' NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);`
    },
    {
      name: "qa.ai_feedback",
      description: "Generative AI audits performed asynchronously by Gemini to review transcripts for coaching bullet points.",
      columns: [
        { name: "id", type: "UUID (PK)", constraints: "DEFAULT uuid_generate_v4()", description: "Primary identifier." },
        { name: "evaluation_id", type: "UUID (FK)", constraints: "REFERENCES qa.evaluations(id) ON DELETE CASCADE", description: "Parent scorecard being analyzed." },
        { name: "transcription", type: "TEXT", constraints: "", description: "Call recording transcript ingested." },
        { name: "sentiment_score", type: "NUMERIC(3,2)", constraints: "", description: "Overall conversation emotional range assessment from 0 (negative) to 1 (highly cooperative)." },
        { name: "auto_suggestions", type: "JSONB", constraints: "", description: "Generated feedback coaching actionable goals list." },
        { name: "compliance_flags", type: "JSONB", constraints: "", description: "Audit flags indicating missing warnings or authentication procedures." }
      ],
      rlsPolicies: [
        "SELECT: Visible to any profile allowed to view the parent scorecard ('evaluation_id') record."
      ],
      sql: `CREATE TABLE qa.ai_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluation_id UUID REFERENCES qa.evaluations(id) ON DELETE CASCADE,
  transcription TEXT,
  sentiment_score NUMERIC(3,2),
  auto_suggestions JSONB,
  compliance_flags JSONB,
  model_version VARCHAR(100) DEFAULT 'gemini-2.5-flash' NOT NULL
);`
    }
  ],
  apiSpecs: [
    {
      path: "/api/qa/evaluations",
      method: "POST" as const,
      description: "Submits an evaluation, computes the final metrics, saves scorecard records, and automatically triggers background Gemini transcript auditing.",
      headers: ["Content-Type: application/json", "Authorization: Bearer <JWT_TOKEN>"],
      requestBody: `{
  "templateId": "2c51080b-222c-473d-8067-ff5d56b063ee",
  "agentId": "6b21080b-1111-473d-8067-ff5d56b063ff",
  "callId": "CALL-10293",
  "scores": {
    "greeting": 100,
    "problemSolving": 80,
    "empathy": 90,
    "wrapUp": 70
  },
  "finalScore": 85,
  "transcriptText": "Agent: Welcome to Precision360! This is Sarah, how can I assist you? Customer: Hi, I'm trying to reset my password..."
}`,
      responseBody: `{
  "success": true,
  "evaluationId": "f9b81234-a621-4cf4-9182-bc1049281a8c"
}`,
      zodSchema: `export const evaluationSchema = z.object({
  templateId: z.string().uuid(),
  agentId: z.string().uuid(),
  callId: z.string().min(3),
  scores: z.record(z.string(), z.number().min(0).max(100)),
  finalScore: z.number().min(0).max(100),
  transcriptText: z.string().optional()
});`
    },
    {
      path: "/api/qa/templates",
      method: "GET" as const,
      description: "Retrieves active Quality evaluation criteria configurations for the authenticated enterprise tenant.",
      headers: ["Authorization: Bearer <JWT_TOKEN>"],
      responseBody: `[
  {
    "id": "2c51080b-222c-473d-8067-ff5d56b063ee",
    "title": "Standard Support Scorecard v1",
    "criteria": {
      "greeting": { "weight": 10, "label": "Professional Greeting", "description": "Greeting protocol compliance." },
      "problemSolving": { "weight": 40, "label": "Root Cause Resolution", "description": "Technical issue assessment accuracy." },
      "empathy": { "weight": 30, "label": "Tone & Empathy", "description": "Active listening and support quality." },
      "wrapUp": { "weight": 20, "label": "Call Wrap-up", "description": "Closing protocol compliance." }
    }
  }
]`,
      zodSchema: `// Schema checking query filters
export const templateQuerySchema = z.object({
  activeOnly: z.boolean().optional().default(true)
});`
    }
  ],
  codingStandards: [
    { title: "Architectural Pattern", rule: "Modular Feature Folders over global arrays. Separate logic/data from interface frames. Next.js App Router boundary management using (groups) and [slugs]." },
    { title: "Type Safety & Assertions", rule: "Zero use of 'any'. Declare types early. Every utility file must export typed functions. Prefer readonly types or custom record constraints where available." },
    { title: "Supabase Isolation Rules", rule: "Always utilize tenant_id partition filters. Maintain strict database Row Level Security (RLS) policies. Read-only direct SELECT allowed in Server Components, but mutations must route via backend route handlers to ensure audit logs." },
    { title: "AI Ingestion Principles", rule: "Always run Gemini API calls in server-side blocks or Server API routes. Limit payload exposure. Ensure response parsing handles edge cases like invalid JSON or partial text outputs gracefully." },
    { title: "UI & Accessibility Rules", rule: "Use functional React components with hooks. Every interface element must utilize standard Lucide-react iconography, support high-contrast light/dark ratios, and follow structured layouts." }
  ]
};
