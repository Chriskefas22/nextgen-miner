create or replace function public.nextgen_reconcile_monetization_reversal(p_original_event_id bigint,p_reversal_usd numeric,p_reversal_reference text,p_reason text default null,p_metadata jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path=''
as $function$
declare original public.nextgen_monetization_revenue_events%rowtype; reversal_id bigint; existing_reversal public.nextgen_monetization_revenue_events%rowtype; already_reversed numeric:=0; remaining numeric:=0; provider_key text;
begin
 if p_original_event_id is null then raise exception 'ORIGINAL_EVENT_REQUIRED'; end if;
 if p_reversal_usd is null or p_reversal_usd<=0 then raise exception 'INVALID_REVERSAL_AMOUNT'; end if;
 if coalesce(length(trim(p_reversal_reference)),0)=0 then raise exception 'REVERSAL_REFERENCE_REQUIRED'; end if;
 if coalesce(length(trim(p_reason)),0)<3 then raise exception 'REVERSAL_REASON_REQUIRED'; end if;
 select * into original from public.nextgen_monetization_revenue_events where id=p_original_event_id for update;
 if not found then raise exception 'ORIGINAL_EVENT_NOT_FOUND'; end if;
 select * into existing_reversal from public.nextgen_monetization_revenue_events where source_type='provider_reversal' and source_reference=trim(p_reversal_reference) for update;
 if found then
   if existing_reversal.reversal_of_event_id is distinct from p_original_event_id then raise exception 'REVERSAL_REFERENCE_ALREADY_USED'; end if;
   return existing_reversal.id;
 end if;
 if lower(original.status) not in ('settled','completed','reversed') then raise exception 'ORIGINAL_EVENT_NOT_RECOVERABLE'; end if;
 if original.net_revenue_usd<=0 then raise exception 'ORIGINAL_EVENT_HAS_NO_RECOVERABLE_NET'; end if;
 perform pg_advisory_xact_lock(hashtext('nextgen_revenue_reversal:'||p_original_event_id::text));
 select coalesce(sum(abs(net_revenue_usd)),0) into already_reversed from public.nextgen_monetization_revenue_events where reversal_of_event_id=p_original_event_id and lower(status) in ('settled','completed');
 remaining:=greatest(original.net_revenue_usd-already_reversed,0);
 if p_reversal_usd>remaining+0.00000001 then raise exception using errcode='P0001',message='REVERSAL_EXCEEDS_RECOVERABLE_REVENUE',detail=jsonb_build_object('original_event_id',p_original_event_id,'original_net_revenue_usd',original.net_revenue_usd,'already_reversed_usd',already_reversed,'remaining_recoverable_usd',remaining,'requested_reversal_usd',p_reversal_usd)::text; end if;
 provider_key:=coalesce(original.provider_key,lower(trim(original.source_type)));
 insert into public.nextgen_monetization_revenue_events(event_date,source_type,source_reference,gross_revenue_usd,user_reward_usd,net_revenue_usd,status,metadata,provider_key,recoverable_at,reversal_of_event_id,reconciliation_note)
 values(original.event_date,'provider_reversal',trim(p_reversal_reference),round(-p_reversal_usd,8),0,round(-p_reversal_usd,8),'settled',coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('original_event_id',p_original_event_id,'original_source_type',original.source_type,'original_source_reference',original.source_reference,'reason',left(trim(p_reason),500)),provider_key,now(),p_original_event_id,left(trim(p_reason),500))
 returning id into reversal_id;
 update public.nextgen_monetization_revenue_events set status=case when already_reversed+p_reversal_usd>=original.net_revenue_usd-0.00000001 then 'reversed' else status end,reconciliation_note=case when already_reversed+p_reversal_usd>=original.net_revenue_usd-0.00000001 then 'Fully reversed; recoverable revenue is exhausted.' else reconciliation_note end where id=p_original_event_id;
 return reversal_id;
end;
$function$;

create or replace function public.nextgen_post_monetization_revenue(p_event_date date,p_source_type text,p_source_reference text,p_gross_revenue_usd numeric,p_user_reward_usd numeric default 0,p_status text default 'pending',p_metadata jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path=''
as $function$
declare v_id bigint; v_net numeric; v_status text:=lower(trim(coalesce(p_status,'pending'))); v_provider_key text:=lower(trim(coalesce(p_metadata->>'provider_key',p_source_type))); v_recoverable_at timestamptz; v_provider_id bigint;
begin
 if p_event_date is null then raise exception 'REVENUE_DATE_REQUIRED'; end if;
 if coalesce(length(trim(p_source_type)),0)=0 or coalesce(length(trim(p_source_reference)),0)=0 then raise exception 'REVENUE_SOURCE_REQUIRED'; end if;
 if p_gross_revenue_usd is null or p_gross_revenue_usd<0 then raise exception 'INVALID_GROSS_REVENUE'; end if;
 if p_user_reward_usd is null or p_user_reward_usd<0 or p_user_reward_usd>p_gross_revenue_usd then raise exception 'INVALID_USER_REWARD'; end if;
 if v_status not in ('pending','posted','approved','settled','completed') then raise exception 'INVALID_REVENUE_STATUS'; end if;
 if v_provider_key in ('offerwall','offer','offer_completion','ptc','shortlink') or p_metadata ? 'provider_key' then
   select id into v_provider_id from public.nextgen_offer_providers where lower(provider_key)=v_provider_key and enabled=true limit 1;
   if v_provider_id is null then raise exception 'PROVIDER_NOT_CONFIGURED'; end if;
 end if;
 if v_status in ('settled','completed') then v_recoverable_at:=now(); end if;
 v_net:=round(p_gross_revenue_usd-p_user_reward_usd,8);
 insert into public.nextgen_monetization_revenue_events(event_date,source_type,source_reference,gross_revenue_usd,user_reward_usd,net_revenue_usd,status,metadata,provider_key,recoverable_at,reconciliation_note)
 values(p_event_date,trim(p_source_type),trim(p_source_reference),round(p_gross_revenue_usd,8),round(p_user_reward_usd,8),v_net,v_status,coalesce(p_metadata,'{}'::jsonb),v_provider_key,v_recoverable_at,case when v_status in ('settled','completed') then 'Provider event accepted as recoverable.' else 'Awaiting provider reconciliation.' end)
 on conflict(source_type,source_reference) do update set event_date=excluded.event_date,gross_revenue_usd=excluded.gross_revenue_usd,user_reward_usd=excluded.user_reward_usd,net_revenue_usd=excluded.net_revenue_usd,status=excluded.status,metadata=excluded.metadata,provider_key=excluded.provider_key,recoverable_at=case when excluded.status in ('settled','completed') then coalesce(public.nextgen_monetization_revenue_events.recoverable_at,excluded.recoverable_at) else null end,reconciliation_note=excluded.reconciliation_note returning id into v_id;
 return v_id;
end;
$function$;

create or replace function public.nextgen_offerwall_reconciliation_snapshot()
returns jsonb language plpgsql security definer stable set search_path=''
as $function$
declare uid uuid:=auth.uid(); provider_count integer:=0; enabled_provider_count integer:=0; event_count bigint:=0; recoverable_count bigint:=0; pending_count bigint:=0; reversed_count bigint:=0; recoverable_net numeric:=0; reversal_net numeric:=0; bad_event_count bigint:=0; orphaned_completion_count bigint:=0;
begin
 if uid is null or not public.nextgen_is_owner() then raise exception 'OWNER_ONLY'; end if;
 select count(*),count(*) filter(where enabled) into provider_count,enabled_provider_count from public.nextgen_offer_providers;
 select count(*) into event_count from public.nextgen_monetization_revenue_events;
 select count(*) into recoverable_count from public.nextgen_monetization_revenue_events where lower(status) in ('settled','completed') and recoverable_at is not null and net_revenue_usd>0;
 select count(*) into pending_count from public.nextgen_monetization_revenue_events where lower(status) in ('pending','posted','approved') or (lower(source_type)<>'provider_reversal' and recoverable_at is null);
 select count(*) into reversed_count from public.nextgen_monetization_revenue_events where lower(status)='reversed' or reversal_of_event_id is not null;
 select coalesce(sum(net_revenue_usd),0) into recoverable_net from public.nextgen_monetization_revenue_events where lower(status) in ('settled','completed') and recoverable_at is not null and net_revenue_usd>0;
 select coalesce(sum(net_revenue_usd),0) into reversal_net from public.nextgen_monetization_revenue_events where reversal_of_event_id is not null and lower(status) in ('settled','completed');
 select count(*) into bad_event_count from public.nextgen_monetization_revenue_events where lower(source_type)<>'provider_reversal' and ((gross_revenue_usd<0 or user_reward_usd<0 or user_reward_usd>gross_revenue_usd) or (lower(status) in ('settled','completed') and recoverable_at is null));
 select count(*) into orphaned_completion_count from public.nextgen_offer_completions oc where lower(oc.status) in ('posted','approved','settled','completed') and not exists(select 1 from public.nextgen_monetization_revenue_events e where e.source_reference=oc.external_reference and e.source_type in ('offerwall','offer','offer_completion'));
 return jsonb_build_object('ok',true,'engine','offerwall_reconciliation_cp07','provider_count',provider_count,'enabled_provider_count',enabled_provider_count,'event_count',event_count,'recoverable_event_count',recoverable_count,'pending_or_unreconciled_event_count',pending_count,'reversed_event_count',reversed_count,'recoverable_net_revenue_usd',round(recoverable_net,8),'reversal_net_revenue_usd',round(reversal_net,8),'invalid_event_count',bad_event_count,'orphaned_posted_offer_completion_count',orphaned_completion_count,'mining_engine_rule','Only settled/completed monetization events with recoverable_at contribute to mining revenue.');
end;
$function$;

revoke execute on function public.nextgen_reconcile_monetization_reversal(bigint,numeric,text,text,jsonb) from public;
grant execute on function public.nextgen_reconcile_monetization_reversal(bigint,numeric,text,text,jsonb) to service_role;
revoke execute on function public.nextgen_post_monetization_revenue(date,text,text,numeric,numeric,text,jsonb) from public;
grant execute on function public.nextgen_post_monetization_revenue(date,text,text,numeric,numeric,text,jsonb) to service_role;
