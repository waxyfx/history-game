-- Migration 026: RPC functions that check the caller must be VOLATILE.
-- private.require_user (and the teacher/admin checks built on it) writes a rate-limit row into private.rate_limits.
-- PostgREST runs STABLE/IMMUTABLE functions in a READ ONLY transaction, so on the live site these six failed with
-- «cannot execute INSERT in a read-only transaction» (HTTP 405): loading cloud saves, the explanation after a trial,
-- the practice replay, the admin Trials keys and the class session list/results. Local tests did not see it because
-- they call the functions outside a read-only transaction. Only the volatility changes; the bodies stay as they are.
alter function public.trial_check(int, text, int) volatile;
alter function public.admin_trial_keys(int) volatile;
alter function public.rpg_save_get(int) volatile;
alter function public.trial_explain(int, text[]) volatile;
alter function public.class_session_list() volatile;
alter function public.class_session_results(uuid) volatile;
