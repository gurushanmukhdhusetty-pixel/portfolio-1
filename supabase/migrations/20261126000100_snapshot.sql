-- One request returns every table (RLS still applies: security invoker).
-- The app calls this on open / refocus instead of 15 separate queries.
create or replace function public.snapshot() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'boards',           coalesce((select jsonb_agg(t order by t.position) from boards t), '[]'),
    'notes',            coalesce((select jsonb_agg(t) from notes t), '[]'),
    'checklists',       coalesce((select jsonb_agg(t order by t.position) from checklists t), '[]'),
    'checklist_items',  coalesce((select jsonb_agg(t order by t.position) from checklist_items t), '[]'),
    'goals',            coalesce((select jsonb_agg(t) from goals t), '[]'),
    'todos',            coalesce((select jsonb_agg(t order by t.position) from todos t), '[]'),
    'files',            coalesce((select jsonb_agg(t) from files t), '[]'),
    'courses',          coalesce((select jsonb_agg(t order by t.position) from courses t), '[]'),
    'grade_components', coalesce((select jsonb_agg(t order by t.position) from grade_components t), '[]'),
    'assessments',      coalesce((select jsonb_agg(t) from assessments t), '[]'),
    'content_pieces',   coalesce((select jsonb_agg(t order by t.position) from content_pieces t), '[]'),
    'content_claims',   coalesce((select jsonb_agg(t) from content_claims t), '[]'),
    'people',           coalesce((select jsonb_agg(t) from people t), '[]'),
    'habits',           coalesce((select jsonb_agg(t order by t.position) from habits t), '[]'),
    'habit_logs',       coalesce((select jsonb_agg(t) from habit_logs t), '[]')
  );
$$;

grant execute on function public.snapshot() to authenticated;
