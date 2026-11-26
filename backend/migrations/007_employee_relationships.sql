-- Independent pairs replace legacy groups. Back up before deployment.
BEGIN;
CREATE TABLE IF NOT EXISTS employee_relationships (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 pair_key VARCHAR(73) NOT NULL UNIQUE,
 mode VARCHAR(16) NOT NULL CHECK (mode IN ('mutual', 'supervisory')),
 access VARCHAR(8) NOT NULL CHECK (access IN ('read', 'full')),
 created_by UUID REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 metadata JSONB NOT NULL DEFAULT '{}',
 CHECK (user_a_id <> user_b_id)
);
CREATE INDEX IF NOT EXISTS ix_employee_relationships_user_a_id ON employee_relationships(user_a_id);
CREATE INDEX IF NOT EXISTS ix_employee_relationships_user_b_id ON employee_relationships(user_b_id);

INSERT INTO employee_relationships (id, user_a_id, user_b_id, pair_key, mode, access, created_by)
SELECT gen_random_uuid(), a.user_id, b.user_id, a.user_id::text || ':' || b.user_id::text,
       'mutual', 'read', MIN(g.created_by::text)::uuid
FROM employee_link_members a
JOIN employee_link_members b ON a.group_id = b.group_id AND a.user_id < b.user_id
JOIN employee_link_groups g ON g.id = a.group_id
GROUP BY a.user_id, b.user_id
ON CONFLICT (pair_key) DO NOTHING;
DELETE FROM employee_link_members;
DELETE FROM employee_link_groups;

COMMIT;
