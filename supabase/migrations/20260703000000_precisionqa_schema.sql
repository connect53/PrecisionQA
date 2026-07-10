-- PrecisionQA Optimized Database Schema Migration
-- Target: Supabase PostgreSQL (Production-Ready, Ultra-Scalable & Free-Tier Friendly)
-- Created: 2026-07-03

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- 1. ROLES & PERMISSIONS DEFINITIONS
--------------------------------------------------------------------------------

CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);

--------------------------------------------------------------------------------
-- 2. USERS & TEAMS STRUCTURE
--------------------------------------------------------------------------------

CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.team_members (
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (team_id, user_id)
);

--------------------------------------------------------------------------------
-- 3. CLIENTS & LINES OF BUSINESS (LOB)
--------------------------------------------------------------------------------

CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE public.lobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

--------------------------------------------------------------------------------
-- 4. SCORECARD GENERATOR ENGINE
--------------------------------------------------------------------------------

CREATE TABLE public.scorecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    lob_id UUID REFERENCES public.lobs(id) ON DELETE SET NULL,
    passing_score NUMERIC(5, 2) DEFAULT 80.00 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE public.scorecard_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scorecard_id UUID REFERENCES public.scorecards(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(150) NOT NULL,
    weight NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    order_index INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.scorecard_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES public.scorecard_sections(id) ON DELETE CASCADE NOT NULL,
    question_text TEXT NOT NULL,
    help_text TEXT,
    weight NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    question_type VARCHAR(50) DEFAULT 'binary' NOT NULL, -- 'binary', 'scale', 'score', 'non_scoring'
    is_critical BOOLEAN DEFAULT FALSE NOT NULL,
    order_index INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

--------------------------------------------------------------------------------
-- 5. BATCH INGESTION & AUDIT CASES
--------------------------------------------------------------------------------

CREATE TABLE public.audit_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    source VARCHAR(100) DEFAULT 'google_sheets' NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
    metadata JSONB,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.audit_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES public.audit_batches(id) ON DELETE CASCADE,
    lob_id UUID REFERENCES public.lobs(id) ON DELETE SET NULL NOT NULL,
    external_case_id VARCHAR(100) NOT NULL,
    customer_name VARCHAR(150),
    agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    auditor_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Consolidated Assignment
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Consolidated Assignment
    due_date TIMESTAMP WITH TIME ZONE, -- Consolidated Assignment
    case_date TIMESTAMP WITH TIME ZONE NOT NULL,
    channel VARCHAR(50) NOT NULL, -- 'call', 'chat', 'email', 'social'
    transcript_url TEXT,
    metadata JSONB, -- Flexible store for sheets data
    status VARCHAR(50) DEFAULT 'unassigned' NOT NULL, -- 'unassigned', 'assigned', 'audited', 'disputed'
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Unique constraint for sheet uploads idempotency
    CONSTRAINT unique_batch_external_case UNIQUE (batch_id, external_case_id)
);

-- Heavy transcript content detached to keep audit_cases lightweight
CREATE TABLE public.case_transcripts (
    case_id UUID PRIMARY KEY REFERENCES public.audit_cases(id) ON DELETE CASCADE,
    transcript_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

--------------------------------------------------------------------------------
-- 6. AUDITING & GRADING ENGINES
--------------------------------------------------------------------------------

CREATE TABLE public.audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.audit_cases(id) ON DELETE CASCADE NOT NULL,
    scorecard_id UUID REFERENCES public.scorecards(id) ON DELETE RESTRICT NOT NULL,
    auditor_id UUID REFERENCES public.users(id) ON DELETE RESTRICT NOT NULL,
    agent_id UUID REFERENCES public.users(id) ON DELETE RESTRICT NOT NULL,
    raw_score NUMERIC(5, 2) NOT NULL,
    weighted_score NUMERIC(5, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' NOT NULL, -- 'draft', 'submitted', 'acknowledged', 'disputed', 'locked'
    is_critical_failed BOOLEAN DEFAULT FALSE NOT NULL,
    general_comments TEXT,
    coaching_notes TEXT,
    locked_at TIMESTAMP WITH TIME ZONE,
    
    -- Dynamic answers JSONB stores dynamic scorecard responses as a single column to reduce rows count
    answers JSONB DEFAULT '[]'::jsonb NOT NULL,
    
    -- Folded agent feedback parameters
    feedback_status VARCHAR(50) DEFAULT 'delivered' NOT NULL, -- 'delivered', 'viewed', 'acknowledged', 'disputed'
    feedback_viewed_at TIMESTAMP WITH TIME ZONE,
    feedback_acknowledged_at TIMESTAMP WITH TIME ZONE,
    feedback_agent_comments TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

--------------------------------------------------------------------------------
-- 7. DISPUTES SYSTEM
--------------------------------------------------------------------------------

CREATE TABLE public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID REFERENCES public.audits(id) ON DELETE CASCADE NOT NULL,
    agent_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    reason_category VARCHAR(100) NOT NULL, -- 'incorrect_grading', 'missing_context', etc.
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open' NOT NULL, -- 'open', 'under_review', 'resolved_approved', 'resolved_rejected'
    resolution_summary TEXT,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.dispute_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID REFERENCES public.disputes(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

--------------------------------------------------------------------------------
-- 8. NOTIFICATIONS, SYSTEM LOGGING & SETTINGS
--------------------------------------------------------------------------------

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'assignment', 'feedback_received', etc.
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action_category VARCHAR(50) NOT NULL, -- 'batch_upload', 'audit_submission', etc.
    description TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

--------------------------------------------------------------------------------
-- 9. OPTIMIZATION INDEXES FOR REPORTING & QUERY PERFORMANCE
--------------------------------------------------------------------------------

-- Users & Teams indexes
CREATE INDEX idx_users_role_id ON public.users(role_id);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_deleted_at ON public.users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_teams_manager_id ON public.teams(manager_id);

-- LOB indexes
CREATE INDEX idx_lobs_client_id ON public.lobs(client_id);

-- Scorecard indexes
CREATE INDEX idx_scorecards_lob_id ON public.scorecards(lob_id);
CREATE INDEX idx_scorecard_sections_scorecard_id ON public.scorecard_sections(scorecard_id);
CREATE INDEX idx_scorecard_questions_section_id ON public.scorecard_questions(section_id);

-- Ingestion & Audit cases indexes (optimized for Google Sheets workflow)
CREATE INDEX idx_audit_batches_created_by ON public.audit_batches(created_by);
CREATE INDEX idx_audit_cases_batch_id ON public.audit_cases(batch_id);
CREATE INDEX idx_audit_cases_agent_id ON public.audit_cases(agent_id);
CREATE INDEX idx_audit_cases_auditor_id ON public.audit_cases(auditor_id);
CREATE INDEX idx_audit_cases_lob_id ON public.audit_cases(lob_id);
CREATE INDEX idx_audit_cases_status ON public.audit_cases(status);
CREATE INDEX idx_audit_cases_external_id ON public.audit_cases(external_case_id);

-- Audit details indexes (highly optimized compound indexes for dashboards/reporting)
CREATE INDEX idx_audits_case_id ON public.audits(case_id);
CREATE INDEX idx_audits_auditor_id ON public.audits(auditor_id);
CREATE INDEX idx_audits_agent_id_status ON public.audits(agent_id, status);
CREATE INDEX idx_audits_reporting ON public.audits(agent_id, created_at, weighted_score);
CREATE INDEX idx_audits_answers_gin ON public.audits USING gin (answers); -- Gin index for dynamic querying of answers

-- Disputes indexes
CREATE INDEX idx_disputes_audit_id ON public.disputes(audit_id);
CREATE INDEX idx_disputes_agent_id ON public.disputes(agent_id);
CREATE INDEX idx_disputes_status ON public.disputes(status);
CREATE INDEX idx_dispute_comments_dispute_id ON public.dispute_comments(dispute_id);

-- Notifications & Logs indexes
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_category ON public.activity_logs(action_category);

--------------------------------------------------------------------------------
-- 10. AUTOMATED MODIFIED TIMESTAMPS
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_modified_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp update triggers
CREATE TRIGGER trigger_update_roles_timestamp BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_users_timestamp BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_teams_timestamp BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_clients_timestamp BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_lobs_timestamp BEFORE UPDATE ON public.lobs FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_scorecards_timestamp BEFORE UPDATE ON public.scorecards FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_scorecard_sections_timestamp BEFORE UPDATE ON public.scorecard_sections FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_scorecard_questions_timestamp BEFORE UPDATE ON public.scorecard_questions FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_audit_batches_timestamp BEFORE UPDATE ON public.audit_batches FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_audit_cases_timestamp BEFORE UPDATE ON public.audit_cases FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_audits_timestamp BEFORE UPDATE ON public.audits FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_disputes_timestamp BEFORE UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_dispute_comments_timestamp BEFORE UPDATE ON public.dispute_comments FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();
CREATE TRIGGER trigger_update_settings_timestamp BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_modified_timestamp();

--------------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

-- Enable Row Level Security (RLS) on tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Helper to fetch current user's role name
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS VARCHAR AS $$
DECLARE
    role_name VARCHAR;
BEGIN
    SELECT r.name INTO role_name
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();
    RETURN role_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. General User access policies (User reads own record, admins/managers/engineers read all)
CREATE POLICY policy_users_select ON public.users 
    FOR SELECT USING (auth.uid() = id OR get_current_user_role() IN ('admin', 'qa_manager', 'qa_engineer'));

CREATE POLICY policy_users_update ON public.users 
    FOR UPDATE USING (auth.uid() = id OR get_current_user_role() = 'admin');

-- 2. Audit Cases policies (Admins/Managers full access, Engineers view/edit, Agents view assigned/audited)
CREATE POLICY policy_cases_select ON public.audit_cases
    FOR SELECT USING (
        get_current_user_role() IN ('admin', 'qa_manager', 'qa_engineer') 
        OR (get_current_user_role() = 'agent' AND agent_id = auth.uid())
    );

CREATE POLICY policy_cases_insert ON public.audit_cases
    FOR INSERT WITH CHECK (get_current_user_role() IN ('admin', 'qa_manager'));

CREATE POLICY policy_cases_update ON public.audit_cases
    FOR UPDATE USING (get_current_user_role() IN ('admin', 'qa_manager', 'qa_engineer'));

-- 3. Case Transcripts policies (Linked securely to parent case access level)
CREATE POLICY policy_transcripts_select ON public.case_transcripts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.audit_cases c 
            WHERE c.id = case_id AND (
                get_current_user_role() IN ('admin', 'qa_manager', 'qa_engineer') 
                OR (get_current_user_role() = 'agent' AND c.agent_id = auth.uid())
            )
        )
    );

CREATE POLICY policy_transcripts_modify ON public.case_transcripts
    FOR ALL USING (get_current_user_role() IN ('admin', 'qa_manager'));

-- 4. Scorecards policies (Public read for authenticated users, modification by admins/managers)
CREATE POLICY policy_scorecards_select ON public.scorecards
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY policy_scorecards_modify ON public.scorecards
    FOR ALL USING (get_current_user_role() IN ('admin', 'qa_manager'));

-- 5. Audits policies (Engineers read/write, Agents only view completed)
CREATE POLICY policy_audits_select ON public.audits
    FOR SELECT USING (
        get_current_user_role() IN ('admin', 'qa_manager')
        OR (get_current_user_role() = 'qa_engineer' AND auditor_id = auth.uid())
        OR (get_current_user_role() = 'agent' AND agent_id = auth.uid() AND status NOT IN ('draft'))
    );

CREATE POLICY policy_audits_modify ON public.audits
    FOR ALL USING (
        get_current_user_role() IN ('admin', 'qa_manager') 
        OR (get_current_user_role() = 'qa_engineer' AND auditor_id = auth.uid() AND status = 'draft')
    );

-- 6. Disputes policies (Agents create/view, Engineers view/resolve, Managers full access)
CREATE POLICY policy_disputes_select ON public.disputes
    FOR SELECT USING (
        get_current_user_role() IN ('admin', 'qa_manager')
        OR (get_current_user_role() = 'qa_engineer' AND resolved_by = auth.uid())
        OR (get_current_user_role() = 'agent' AND agent_id = auth.uid())
    );

CREATE POLICY policy_disputes_insert ON public.disputes
    FOR INSERT WITH CHECK (get_current_user_role() = 'agent' AND agent_id = auth.uid());

CREATE POLICY policy_disputes_update ON public.disputes
    FOR UPDATE USING (get_current_user_role() IN ('admin', 'qa_manager', 'qa_engineer'));

-- 7. Notifications policy (Users read/update own notifications)
CREATE POLICY policy_notifications ON public.notifications
    FOR ALL USING (user_id = auth.uid());

-- 8. Activity Logs (Only Admins read logs, anyone writes)
CREATE POLICY policy_logs_select ON public.activity_logs
    FOR SELECT USING (get_current_user_role() = 'admin');

CREATE POLICY policy_logs_insert ON public.activity_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 9. Administrative & Master Data Policies (Allow read to all authenticated, modification to Admins/QA Managers)
CREATE POLICY policy_roles_select ON public.roles
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY policy_roles_modify ON public.roles
    FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY policy_permissions_select ON public.permissions
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY policy_permissions_modify ON public.permissions
    FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY policy_role_permissions_select ON public.role_permissions
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY policy_role_permissions_modify ON public.role_permissions
    FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY policy_clients_select ON public.clients
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY policy_clients_modify ON public.clients
    FOR ALL USING (get_current_user_role() IN ('admin', 'qa_manager', 'super_admin'));

CREATE POLICY policy_lobs_select ON public.lobs
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY policy_lobs_modify ON public.lobs
    FOR ALL USING (get_current_user_role() IN ('admin', 'qa_manager', 'super_admin'));

CREATE POLICY policy_teams_select ON public.teams
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY policy_teams_modify ON public.teams
    FOR ALL USING (get_current_user_role() IN ('admin', 'qa_manager', 'super_admin'));

CREATE POLICY policy_team_members_select ON public.team_members
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY policy_team_members_modify ON public.team_members
    FOR ALL USING (get_current_user_role() IN ('admin', 'qa_manager', 'super_admin'));

CREATE POLICY policy_settings_select ON public.settings
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY policy_settings_modify ON public.settings
    FOR ALL USING (get_current_user_role() IN ('admin', 'qa_manager', 'super_admin'));
