import type { User } from '@supabase/supabase-js';
import {
	type ChecklistOutcome,
	type ChecklistPhase,
	type ChecklistRun,
	type ChecklistRunItem,
	type ChecklistStatus,
	getChecklistRuns,
	mergeChecklistRuns,
} from './checklist-state';
import { getGoogleUser, signInWithGoogle, signOutGoogleUser } from './google-auth';
import { getSupabaseClient } from './supabase-client';

const statuses = new Set<ChecklistStatus>([
	'in_progress',
	'prepared',
	'review_pending',
	'completed',
]);
const phases = new Set<ChecklistPhase>(['have', 'prepare', 'pack_day']);
const outcomes = new Set<ChecklistOutcome>(['used', 'unused', 'missed', 'remove_next']);

export async function getChecklistUser(): Promise<User | null> {
	return getGoogleUser();
}

export async function signInToSaveChecklist() {
	const redirectUrl = new URL(window.location.href);
	redirectUrl.hash = 'progress';
	await signInWithGoogle(redirectUrl.toString());
}

export async function signOutChecklistUser() {
	await signOutGoogleUser();
}

export async function syncChecklistRun(run: ChecklistRun, user?: User | null) {
	const supabase = getSupabaseClient();
	const activeUser = user ?? await getChecklistUser();
	if (!supabase || !activeUser) return false;

	const { data: savedRun, error: runError } = await supabase
		.from('checklist_runs')
		.upsert({
			user_id: activeUser.id,
			local_run_id: run.runId,
			checklist_key: run.checklistId,
			template_version: run.templateVersion,
			status: run.status,
			started_at: run.startedAt,
			prepared_at: run.preparedAt ?? null,
			review_started_at: run.reviewStartedAt ?? null,
			completed_at: run.completedAt ?? null,
			client_updated_at: run.updatedAt,
		}, { onConflict: 'user_id,local_run_id' })
		.select('id')
		.single();
	if (runError) throw runError;

	const rows = run.items.map((item) => ({
		id: item.id,
		run_id: savedRun.id,
		item_key: item.itemKey,
		group_key: item.groupId,
		group_label: item.groupLabel,
		label: item.label,
		origin: item.origin,
		phase: item.phase,
		display_order: item.order,
		is_checked: item.checked,
		checked_at: item.checkedAt ?? null,
		is_hidden: item.hidden,
		personal_note: item.note || null,
	}));

	if (rows.length > 0) {
		const { error: itemError } = await supabase
			.from('checklist_run_items')
			.upsert(rows, { onConflict: 'id' });
		if (itemError) throw itemError;
	}

	const itemIds = rows.map((row) => row.id);
	const { data: existingItems, error: existingError } = await supabase
		.from('checklist_run_items')
		.select('id')
		.eq('run_id', savedRun.id);
	if (existingError) throw existingError;
	const removedIds = (existingItems ?? [])
		.map((item) => item.id as string)
		.filter((id) => !itemIds.includes(id));
	if (removedIds.length > 0) {
		const { error: removeError } = await supabase
			.from('checklist_run_items')
			.delete()
			.in('id', removedIds);
		if (removeError) throw removeError;
	}

	const { error: clearFeedbackError } = await supabase
		.from('checklist_item_feedback')
		.delete()
		.eq('run_id', savedRun.id);
	if (clearFeedbackError) throw clearFeedbackError;

	const feedbackRows = run.items
		.filter((item) => item.outcome)
		.map((item) => ({
			run_item_id: item.id,
			run_id: savedRun.id,
			outcome: item.outcome,
		}));
	if (feedbackRows.length > 0) {
		const { error: feedbackError } = await supabase
			.from('checklist_item_feedback')
			.insert(feedbackRows);
		if (feedbackError) throw feedbackError;
	}
	return true;
}

export async function syncAllLocalChecklistRuns(user?: User | null) {
	const activeUser = user ?? await getChecklistUser();
	if (!activeUser) return;
	for (const run of getChecklistRuns()) {
		await syncChecklistRun(run, activeUser);
	}
}

export async function hydrateChecklistRunsFromSupabase(user?: User | null): Promise<ChecklistRun[]> {
	const supabase = getSupabaseClient();
	const activeUser = user ?? await getChecklistUser();
	if (!supabase || !activeUser) return [];

	const { data: runRows, error: runError } = await supabase
		.from('checklist_runs')
		.select('*')
		.eq('user_id', activeUser.id)
		.order('updated_at', { ascending: false });
	if (runError) throw runError;
	if (!runRows?.length) return [];

	const serverRunIds = runRows.map((run) => run.id as string);
	const [{ data: itemRows, error: itemError }, { data: feedbackRows, error: feedbackError }] = await Promise.all([
		supabase.from('checklist_run_items').select('*').in('run_id', serverRunIds),
		supabase.from('checklist_item_feedback').select('*').in('run_id', serverRunIds),
	]);
	if (itemError) throw itemError;
	if (feedbackError) throw feedbackError;

	const feedbackByItem = new Map<string, ChecklistOutcome>();
	for (const feedback of feedbackRows ?? []) {
		if (outcomes.has(feedback.outcome as ChecklistOutcome)) {
			feedbackByItem.set(feedback.run_item_id as string, feedback.outcome as ChecklistOutcome);
		}
	}

	const itemsByRun = new Map<string, ChecklistRunItem[]>();
	for (const item of itemRows ?? []) {
		const phase = phases.has(item.phase as ChecklistPhase) ? item.phase as ChecklistPhase : 'prepare';
		const runItem: ChecklistRunItem = {
			id: item.id as string,
			itemKey: item.item_key as string,
			groupId: item.group_key as string,
			groupLabel: item.group_label as string,
			label: item.label as string,
			origin: item.origin === 'custom' ? 'custom' : 'template',
			phase,
			order: item.display_order as number,
			checked: Boolean(item.is_checked),
			checkedAt: item.checked_at ?? undefined,
			hidden: Boolean(item.is_hidden),
			note: item.personal_note ?? '',
			outcome: feedbackByItem.get(item.id as string),
		};
		const collection = itemsByRun.get(item.run_id as string) ?? [];
		collection.push(runItem);
		itemsByRun.set(item.run_id as string, collection);
	}

	const runs = runRows.map((row): ChecklistRun => ({
		runId: row.local_run_id as string,
		checklistId: row.checklist_key as string,
		templateVersion: row.template_version as number,
		status: statuses.has(row.status as ChecklistStatus) ? row.status as ChecklistStatus : 'in_progress',
		items: (itemsByRun.get(row.id as string) ?? []).sort((a, b) => a.order - b.order),
		startedAt: row.started_at as string,
		preparedAt: row.prepared_at ?? undefined,
		reviewStartedAt: row.review_started_at ?? undefined,
		completedAt: row.completed_at ?? undefined,
		updatedAt: (row.client_updated_at ?? row.updated_at) as string,
	}));
	mergeChecklistRuns(runs);
	return runs;
}

export async function deleteChecklistRunFromSupabase(localRunId: string) {
	const supabase = getSupabaseClient();
	const user = await getChecklistUser();
	if (!supabase || !user) return;
	const { error } = await supabase
		.from('checklist_runs')
		.delete()
		.eq('user_id', user.id)
		.eq('local_run_id', localRunId);
	if (error) throw error;
}

export async function deleteChecklistAccount() {
	const supabase = getSupabaseClient();
	if (!supabase) throw new Error('Supabaseの接続情報が設定されていません。');
	const { error } = await supabase.functions.invoke('delete-checklist-account');
	if (error) throw error;
}
