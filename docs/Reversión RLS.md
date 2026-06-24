begin;

create or replace function public.anima_is_active_employee()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = auth.uid()
      and e.is_active = true
  );
$$;

create or replace function public.anima_is_active_owner()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = auth.uid()
      and e.is_active = true
      and e.role = 'propietario'
  );
$$;

create or replace function public.anima_latest_attendance_log_id_for_current_user()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select al.id
  from public.attendance_logs al
  where al.employee_id = auth.uid()
  order by al.occurred_at desc, al.created_at desc
  limit 1;
$$;

revoke all on function public.anima_is_active_employee() from public;
revoke all on function public.anima_is_active_owner() from public;
revoke all on function public.anima_latest_attendance_log_id_for_current_user() from public;

grant execute on function public.anima_is_active_employee() to authenticated;
grant execute on function public.anima_is_active_owner() to authenticated;
grant execute on function public.anima_latest_attendance_log_id_for_current_user() to authenticated;

alter table public.attendance_logs enable row level security;

drop policy if exists "attendance_logs_select_owner_only_restrictive" on public.attendance_logs;
drop policy if exists "attendance_logs_select_owner_only_permissive" on public.attendance_logs;
drop policy if exists "attendance_logs_select_operational_restrictive" on public.attendance_logs;
drop policy if exists "attendance_logs_select_authenticated_permissive" on public.attendance_logs;
drop policy if exists "attendance_logs_insert_self_active" on public.attendance_logs;
drop policy if exists "attendance_logs_insert_active_self_restrictive" on public.attendance_logs;
drop policy if exists "attendance_logs_insert_authenticated_permissive" on public.attendance_logs;

create policy "attendance_logs_select_authenticated_permissive"
on public.attendance_logs
as permissive
for select
to authenticated
using (true);

create policy "attendance_logs_select_operational_restrictive"
on public.attendance_logs
as restrictive
for select
to authenticated
using (
  public.anima_is_active_owner()
  or (
    employee_id = auth.uid()
    and public.anima_is_active_employee()
    and id = public.anima_latest_attendance_log_id_for_current_user()
  )
);

create policy "attendance_logs_insert_authenticated_permissive"
on public.attendance_logs
as permissive
for insert
to authenticated
with check (true);

create policy "attendance_logs_insert_active_self_restrictive"
on public.attendance_logs
as restrictive
for insert
to authenticated
with check (
  employee_id = auth.uid()
  and public.anima_is_active_employee()
);

commit;