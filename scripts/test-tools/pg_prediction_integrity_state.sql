-- Emit a canonical catalog snapshot for every object touched by
-- 20260825160000_prediction_integrity_restore.sql. pg_migration_cycle.sh takes
-- one snapshot immediately before applying that migration and compares it with
-- the state immediately after rolling back only that migration.
with target_table as (
  select c.oid, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'predictions'
    and c.relkind in ('r', 'p')
),
policy_state as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', policyname,
        'permissive', permissive,
        'roles', roles,
        'command', cmd,
        'using', qual,
        'check', with_check
      ) order by policyname
    ),
    '[]'::jsonb
  ) as value
  from pg_policies
  where schemaname = 'public'
    and tablename = 'predictions'
),
table_acl_state as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'grantor', pg_get_userbyid(a.grantor),
        'grantee', case
          when a.grantee = 0 then 'PUBLIC'
          else pg_get_userbyid(a.grantee)
        end,
        'privilege', a.privilege_type,
        'grantable', a.is_grantable
      ) order by a.grantee, a.privilege_type, a.grantor
    ),
    '[]'::jsonb
  ) as value
  from target_table t
  cross join lateral aclexplode(
    coalesce(t.relacl, acldefault('r', t.relowner))
  ) as a
),
target_function as (
  select p.oid, p.proowner, p.proacl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'enforce_prediction_integrity'
    and pg_get_function_identity_arguments(p.oid) = ''
),
function_state as (
  select jsonb_build_object(
    'owner', pg_get_userbyid(f.proowner),
    'definition', pg_get_functiondef(f.oid)
  ) as value
  from target_function f
),
function_acl_state as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'grantor', pg_get_userbyid(a.grantor),
        'grantee', case
          when a.grantee = 0 then 'PUBLIC'
          else pg_get_userbyid(a.grantee)
        end,
        'privilege', a.privilege_type,
        'grantable', a.is_grantable
      ) order by a.grantee, a.privilege_type, a.grantor
    ),
    '[]'::jsonb
  ) as value
  from target_function f
  cross join lateral aclexplode(
    coalesce(f.proacl, acldefault('f', f.proowner))
  ) as a
),
trigger_state as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', t.tgname,
        'enabled', t.tgenabled,
        'definition', pg_get_triggerdef(t.oid, true)
      ) order by t.tgname
    ),
    '[]'::jsonb
  ) as value
  from target_table c
  join pg_trigger t on t.tgrelid = c.oid
  where not t.tgisinternal
),
index_state as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', i.indexrelid::regclass::text,
        'definition', pg_get_indexdef(i.indexrelid),
        'unique', i.indisunique,
        'valid', i.indisvalid,
        'ready', i.indisready
      ) order by i.indexrelid::regclass::text
    ),
    '[]'::jsonb
  ) as value
  from target_table c
  join pg_index i on i.indrelid = c.oid
)
select jsonb_build_object(
  'row_security', (
    select jsonb_build_object(
      'enabled', relrowsecurity,
      'forced', relforcerowsecurity
    )
    from target_table
  ),
  'policies', (select value from policy_state),
  'table_acl', (select value from table_acl_state),
  'function', (select value from function_state),
  'function_acl', (select value from function_acl_state),
  'triggers', (select value from trigger_state),
  'indexes', (select value from index_state)
)::text;
