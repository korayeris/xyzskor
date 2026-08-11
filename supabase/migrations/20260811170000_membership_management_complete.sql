-- XYZSKOR tam üyelik yönetimi: hesap durumu, yasal onay, KVKK talepleri ve admin güvenlik görünümü.
begin;

alter table public.profiles add column if not exists account_status text not null default 'active'
  check (account_status in ('active','suspended','closed'));
alter table public.profiles add column if not exists suspended_reason text;
alter table public.profiles add column if not exists suspended_until timestamptz;
alter table public.profiles add column if not exists status_changed_at timestamptz;
alter table public.profiles add column if not exists status_changed_by uuid references auth.users(id);
create index if not exists profiles_account_status_idx on public.profiles(account_status, created_at desc);

alter table public.reward_campaigns add column if not exists eligibility_mode text not null default 'admin_grant'
  check (eligibility_mode in ('admin_grant','open'));
create table if not exists public.reward_entitlements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.reward_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null default 'manual_admin' check (source_type in ('prediction_week','weekly_game','manual_admin')),
  source_id text not null,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(campaign_id,user_id,source_type,source_id)
);
create index if not exists reward_entitlements_user_idx on public.reward_entitlements(user_id,granted_at desc) where revoked_at is null;
alter table public.reward_entitlements enable row level security;
create policy reward_entitlements_own_read on public.reward_entitlements for select to authenticated using(user_id=auth.uid());
create policy reward_entitlements_admin_all on public.reward_entitlements for all to authenticated using(public.is_admin()) with check(public.is_admin());
revoke all on public.reward_entitlements from anon,authenticated;
grant select on public.reward_entitlements to authenticated;
grant insert,update,delete on public.reward_entitlements to authenticated;

create or replace function public.is_active_member(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.deleted_at is null
      and (p.account_status = 'active' or (p.account_status = 'suspended' and p.suspended_until is not null and p.suspended_until <= now()))
  );
$$;

create or replace function public.get_my_legal_status()
returns table(document_key text, version text, title text, url_path text, consent_scope text, accepted_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select d.document_key, d.version, d.title, d.url_path,
    case when d.document_key = 'kvkk_notice' then 'kvkk_notice' else 'required' end,
    c.accepted_at
  from public.legal_documents d
  left join public.user_consents c on c.user_id = auth.uid()
    and c.document_key = d.document_key and c.version = d.version and c.revoked_at is null
  where auth.uid() is not null and d.is_active and d.is_required and d.effective_at <= now()
  order by d.document_key;
$$;

create or replace function public.request_reward_claim(p_campaign_id uuid, p_source_type text, p_source_id text)
returns public.reward_claims language plpgsql security definer set search_path = public, pg_temp as $$
declare claim public.reward_claims; campaign public.reward_campaigns;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.'; end if;
  if not public.is_active_member() then raise exception 'Aktif üyelik gerekli.'; end if;
  select * into campaign from public.reward_campaigns where id=p_campaign_id;
  if campaign.id is null or campaign.status<>'active' then raise exception 'Aktif kampanya bulunamadı.'; end if;
  if campaign.starts_at is not null and campaign.starts_at>now() then raise exception 'Kampanya henüz başlamadı.'; end if;
  if campaign.ends_at is not null and campaign.ends_at<=now() then raise exception 'Kampanya sona erdi.'; end if;
  if campaign.eligibility_mode='admin_grant' and not exists(select 1 from public.reward_entitlements e where e.campaign_id=p_campaign_id and e.user_id=auth.uid() and e.revoked_at is null) then
    raise exception 'Bu kampanya için tanımlı ödül hakkın bulunmuyor.';
  end if;
  insert into public.reward_claims(campaign_id,user_id,source_type,source_id,pii_expires_at)
  values(p_campaign_id,auth.uid(),p_source_type,p_source_id,now()+interval '180 days')
  on conflict(campaign_id,user_id,source_type,source_id) do update set updated_at=now() returning * into claim;
  return claim;
end;
$$;

create or replace function public.get_my_reward_campaigns()
returns setof public.reward_campaigns language sql stable security definer set search_path=public,pg_temp as $$
  select c.* from public.reward_campaigns c where auth.uid() is not null and c.status='active'
    and (c.starts_at is null or c.starts_at<=now()) and (c.ends_at is null or c.ends_at>now())
    and (c.eligibility_mode='open' or exists(select 1 from public.reward_entitlements e where e.campaign_id=c.id and e.user_id=auth.uid() and e.revoked_at is null))
  order by c.starts_at desc nulls last,c.created_at desc;
$$;

create or replace function public.grant_reward_entitlement(p_campaign_id uuid,p_user_id uuid,p_source_type text default 'manual_admin',p_source_id text default 'admin_panel')
returns public.reward_entitlements language plpgsql security definer set search_path=public,pg_temp as $$
declare granted public.reward_entitlements;
begin
  if not public.is_admin() then raise exception 'Admin yetkisi gerekli.'; end if;
  if not exists(select 1 from public.reward_campaigns where id=p_campaign_id) then raise exception 'Kampanya bulunamadı.'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Üye bulunamadı.'; end if;
  insert into public.reward_entitlements(campaign_id,user_id,source_type,source_id,granted_by)
  values(p_campaign_id,p_user_id,p_source_type,p_source_id,auth.uid())
  on conflict(campaign_id,user_id,source_type,source_id) do update set revoked_at=null,granted_by=auth.uid(),granted_at=now() returning * into granted;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,after_data)
  values(auth.uid(),'reward_entitlement_granted','reward_entitlement',granted.id::text,to_jsonb(granted));
  return granted;
end;
$$;

create or replace function public.submit_weekly_game_entry(p_game_id uuid,p_answer_payload jsonb,p_client_fingerprint_hash text default null)
returns public.weekly_game_entries language plpgsql security definer set search_path = public, pg_temp as $$
declare target_game public.weekly_games; entry public.weekly_game_entries;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.'; end if;
  if not public.is_active_member() then raise exception 'Aktif üyelik gerekli.'; end if;
  select * into target_game from public.weekly_games where id=p_game_id;
  if target_game.id is null then raise exception 'Oyun bulunamadı.'; end if;
  if target_game.status<>'published' then raise exception 'Bu oyun girişe açık değil.'; end if;
  if target_game.opens_at is not null and now()<target_game.opens_at then raise exception 'Oyun henüz açılmadı.'; end if;
  if target_game.locks_at is not null and now()>=target_game.locks_at then raise exception 'Oyun kilitlendi.'; end if;
  insert into public.weekly_game_entries(game_id,user_id,answer_payload,client_fingerprint_hash,submitted_at)
  values(p_game_id,auth.uid(),coalesce(p_answer_payload,'{}'::jsonb),p_client_fingerprint_hash,now())
  on conflict(game_id,user_id) do update set answer_payload=excluded.answer_payload,client_fingerprint_hash=excluded.client_fingerprint_hash,submitted_at=now()
  where public.weekly_game_entries.locked_at is null returning * into entry;
  if entry.id is null then raise exception 'Bu oyun girişi kilitli.'; end if;
  return entry;
end;
$$;

create or replace function public.submit_privacy_request(p_request_type text, p_details text default null)
returns public.user_privacy_requests language plpgsql security definer set search_path = public, pg_temp as $$
declare created public.user_privacy_requests;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.'; end if;
  if p_request_type not in ('access','correction','deletion','restriction','objection','export','consent_withdrawal') then
    raise exception 'Geçersiz talep türü.';
  end if;
  if p_details is not null and char_length(p_details) > 2000 then raise exception 'Açıklama 2000 karakteri aşamaz.'; end if;
  if exists (select 1 from public.user_privacy_requests where user_id=auth.uid() and status in ('received','reviewing','waiting_user') and created_at > now()-interval '24 hours') then
    raise exception 'Devam eden talebin varken 24 saat içinde yeni talep açılamaz.';
  end if;
  insert into public.user_privacy_requests(user_id, request_type, details)
  values(auth.uid(), p_request_type, nullif(btrim(p_details),'')) returning * into created;
  return created;
end;
$$;

create or replace function public.list_privacy_requests_admin(p_status text default null, p_limit integer default 100)
returns table(id uuid, user_id uuid, email text, username text, request_type text, status text, details text, response_summary text, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin yetkisi gerekli.'; end if;
  return query select r.id,r.user_id,u.email::text,p.username,r.request_type,r.status,r.details,r.response_summary,r.created_at,r.updated_at
  from public.user_privacy_requests r left join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id
  where p_status is null or r.status=p_status order by r.created_at desc limit greatest(1,least(coalesce(p_limit,100),200));
end;
$$;

create or replace function public.review_privacy_request(p_request_id uuid, p_status text, p_response_summary text default null)
returns public.user_privacy_requests language plpgsql security definer set search_path = public, pg_temp as $$
declare before_row jsonb; changed public.user_privacy_requests;
begin
  if not public.is_admin() then raise exception 'Admin yetkisi gerekli.'; end if;
  if p_status not in ('received','reviewing','waiting_user','completed','rejected') then raise exception 'Geçersiz durum.'; end if;
  select to_jsonb(r.*) into before_row from public.user_privacy_requests r where r.id=p_request_id;
  update public.user_privacy_requests set status=p_status,response_summary=nullif(btrim(p_response_summary),''),handled_by=auth.uid(),updated_at=now(),resolved_at=case when p_status in ('completed','rejected') then now() else null end
  where id=p_request_id returning * into changed;
  if changed.id is null then raise exception 'Talep bulunamadı.'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,before_data,after_data)
  values(auth.uid(),'privacy_request_reviewed','privacy_request',p_request_id::text,before_row,to_jsonb(changed));
  return changed;
end;
$$;

create or replace function public.set_member_account_status(p_user_id uuid, p_status text, p_reason text default null, p_suspended_until timestamptz default null)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare before_row jsonb; changed public.profiles;
begin
  if not public.is_admin() then raise exception 'Admin yetkisi gerekli.'; end if;
  if p_status not in ('active','suspended','closed') then raise exception 'Geçersiz hesap durumu.'; end if;
  if p_user_id=auth.uid() and p_status<>'active' then raise exception 'Kendi hesabını panelden kapatamazsın.'; end if;
  select to_jsonb(p.*) into before_row from public.profiles p where p.id=p_user_id;
  update public.profiles set account_status=p_status,suspended_reason=case when p_status='active' then null else nullif(btrim(p_reason),'') end,
    suspended_until=case when p_status='suspended' then p_suspended_until else null end,status_changed_at=now(),status_changed_by=auth.uid(),
    deleted_at=case when p_status='closed' then coalesce(deleted_at,now()) else null end,updated_at=now()
  where id=p_user_id returning * into changed;
  if changed.id is null then raise exception 'Üye bulunamadı.'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,before_data,after_data)
  values(auth.uid(),'member_account_status_set','profile',p_user_id::text,before_row,to_jsonb(changed));
  return changed;
end;
$$;

create or replace function public.list_member_security_events(p_user_id uuid default null, p_limit integer default 100)
returns table(id bigint,user_id uuid,event_type text,risk_score integer,metadata jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin yetkisi gerekli.'; end if;
  return query select e.id,e.user_id,e.event_type,e.risk_score,e.metadata,e.created_at from public.account_security_events e
  where p_user_id is null or e.user_id=p_user_id order by e.created_at desc limit greatest(1,least(coalesce(p_limit,100),200));
end;
$$;

create or replace function public.list_member_account_statuses_admin()
returns table(user_id uuid, account_status text, suspended_reason text, suspended_until timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin yetkisi gerekli.'; end if;
  return query select p.id,p.account_status,p.suspended_reason,p.suspended_until from public.profiles p order by p.created_at desc limit 500;
end;
$$;

create or replace function public.log_account_security_event(p_event_type text,p_ip_hash text default null,p_user_agent_hash text default null,p_risk_score integer default 0,p_metadata jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare new_id bigint;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.'; end if;
  if p_event_type not in ('signup','login','logout','prediction_submit','game_submit','reward_claim') then raise exception 'İstemci bu güvenlik olayı türünü yazamaz.'; end if;
  insert into public.account_security_events(user_id,event_type,ip_hash,user_agent_hash,risk_score,metadata)
  values(auth.uid(),p_event_type,null,null,greatest(0,least(20,coalesce(p_risk_score,0))),coalesce(p_metadata,'{}'::jsonb)) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.purge_expired_reward_claim_pii()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare affected integer;
begin
  update public.reward_claims set shipping_name=null,shipping_phone=null,shipping_address=null,updated_at=now()
  where pii_expires_at is not null and pii_expires_at<=now() and (shipping_name is not null or shipping_phone is not null or shipping_address is not null);
  get diagnostics affected=row_count;
  return affected;
end;
$$;

drop policy if exists predictions_own_insert on public.predictions;
drop policy if exists predictions_own_update on public.predictions;
create policy predictions_own_insert on public.predictions for insert to authenticated with check (user_id=auth.uid() and public.is_active_member());
create policy predictions_own_update on public.predictions for update to authenticated using (user_id=auth.uid() and public.is_active_member()) with check (user_id=auth.uid() and public.is_active_member());
drop policy if exists weekly_entries_own_insert on public.weekly_game_entries;
drop policy if exists weekly_entries_own_update_unlocked on public.weekly_game_entries;
create policy weekly_entries_own_insert on public.weekly_game_entries for insert to authenticated with check (user_id=auth.uid() and public.is_active_member());
create policy weekly_entries_own_update_unlocked on public.weekly_game_entries for update to authenticated using (user_id=auth.uid() and locked_at is null and public.is_active_member()) with check (user_id=auth.uid() and locked_at is null and public.is_active_member());
drop policy if exists reward_claims_own_insert on public.reward_claims;
create policy reward_claims_own_insert on public.reward_claims for insert to authenticated with check (user_id=auth.uid() and public.is_active_member());
drop policy if exists reward_claims_own_update_pending on public.reward_claims;
create policy reward_claims_own_update_pending on public.reward_claims for update to authenticated using (user_id=auth.uid() and status in ('pending','identity_check') and public.is_active_member()) with check (user_id=auth.uid() and status in ('pending','identity_check') and public.is_active_member());

revoke all on function public.is_active_member(uuid) from public;
revoke all on function public.request_reward_claim(uuid,text,text) from public;
revoke all on function public.get_my_reward_campaigns() from public;
revoke all on function public.grant_reward_entitlement(uuid,uuid,text,text) from public;
revoke all on function public.submit_weekly_game_entry(uuid,jsonb,text) from public;
revoke all on function public.get_my_legal_status() from public;
revoke all on function public.submit_privacy_request(text,text) from public;
revoke all on function public.list_privacy_requests_admin(text,integer) from public;
revoke all on function public.review_privacy_request(uuid,text,text) from public;
revoke all on function public.set_member_account_status(uuid,text,text,timestamptz) from public;
revoke all on function public.list_member_security_events(uuid,integer) from public;
revoke all on function public.list_member_account_statuses_admin() from public;
revoke all on function public.log_account_security_event(text,text,text,integer,jsonb) from public;
revoke all on function public.purge_expired_reward_claim_pii() from public;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.request_reward_claim(uuid,text,text) to authenticated;
grant execute on function public.get_my_reward_campaigns() to authenticated;
grant execute on function public.grant_reward_entitlement(uuid,uuid,text,text) to authenticated;
grant execute on function public.submit_weekly_game_entry(uuid,jsonb,text) to authenticated;
grant execute on function public.get_my_legal_status() to authenticated;
grant execute on function public.submit_privacy_request(text,text) to authenticated;
grant execute on function public.list_privacy_requests_admin(text,integer) to authenticated;
grant execute on function public.review_privacy_request(uuid,text,text) to authenticated;
grant execute on function public.set_member_account_status(uuid,text,text,timestamptz) to authenticated;
grant execute on function public.list_member_security_events(uuid,integer) to authenticated;
grant execute on function public.list_member_account_statuses_admin() to authenticated;
grant execute on function public.log_account_security_event(text,text,text,integer,jsonb) to authenticated;
grant execute on function public.purge_expired_reward_claim_pii() to service_role;

comment on function public.set_member_account_status(uuid,text,text,timestamptz) is 'Adminin üye hesabını aktif, askıda veya kapalı duruma almasını ve işlemi denetim kaydına yazmasını sağlar.';
commit;
-- GERİ ALMA PLANI: yeni fonksiyon ve kolonları ayrı migration ile kaldır; değiştirilen RLS politikalarını platform_core tanımlarına döndür.
