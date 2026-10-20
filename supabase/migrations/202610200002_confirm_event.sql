create or replace function public.confirm_match_event(
  p_match_id uuid,
  p_expected_version bigint,
  p_event_id uuid,
  p_idempotency_key uuid,
  p_team char(1),
  p_new_state jsonb,
  p_finishes_match boolean default false
) returns table(event_id uuid, match_version bigint)
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_next_version bigint;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_team not in ('A','B') then raise exception 'invalid team' using errcode='22023'; end if;

  -- Locking the match prevents two devices from confirming the same version.
  select version + 1 into v_next_version from public.matches
  where id=p_match_id and version=p_expected_version and status in ('live','paused')
    and (created_by=v_actor or operator_id=v_actor)
  for update;

  if v_next_version is null then
    if exists(select 1 from public.match_events where match_id=p_match_id and idempotency_key=p_idempotency_key) then
      return query select id, match_events.match_version from public.match_events where match_id=p_match_id and idempotency_key=p_idempotency_key;
      return;
    end if;
    raise exception 'version conflict or unauthorized operator' using errcode='40001';
  end if;

  update public.matches set state=p_new_state, version=v_next_version,
    status=case when p_finishes_match then 'finished'::public.match_status else status end,
    finished_at=case when p_finishes_match then now() else finished_at end, updated_at=now()
  where id=p_match_id;

  insert into public.match_events(id,match_id,type,team,payload,actor_id,idempotency_key,match_version)
  values(p_event_id,p_match_id,case when p_finishes_match then 'MATCH_FINISHED' else 'POINT_CONFIRMED' end,p_team,'{}',v_actor,p_idempotency_key,v_next_version);
  insert into public.match_state_snapshots(match_id,version,state) values(p_match_id,v_next_version,p_new_state);
  insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
  values(v_actor,'confirm_match_event','match',p_match_id,jsonb_build_object('version',v_next_version,'team',p_team));
  return query select p_event_id,v_next_version;
end;
$$;

revoke all on function public.confirm_match_event(uuid,bigint,uuid,uuid,char,jsonb,boolean) from public;
grant execute on function public.confirm_match_event(uuid,bigint,uuid,uuid,char,jsonb,boolean) to authenticated;
