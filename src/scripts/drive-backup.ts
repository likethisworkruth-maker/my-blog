import type { ChecklistRun } from './checklist-state.ts';
import {
	clearBackupQueue,
	getOrCreateDeviceId,
	getPrivateChecklistRuns,
	getPrivateDataRevision,
	getPrivateSetting,
	importPrivateChecklistRuns,
	normalizeChecklistRun,
	setPrivateSetting,
} from './private-db.ts';

export const DRIVE_BACKUP_FILE_NAME = 'likethis-private-backup-v1.json';
export const DRIVE_BACKUP_SCHEMA_VERSION = 1;
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SYNC_STATE_KEY = 'drive-sync-state-v1';
const LAST_BACKUP_KEY = 'drive-last-backup-at';

export interface DriveBackupPayload {
	schemaVersion: 1;
	deviceId: string;
	revision: number;
	exportedAt: string;
	runs: ChecklistRun[];
}

interface DriveFile {
	id: string;
	name: string;
	modifiedTime?: string;
}

interface DriveSyncState {
	fileId: string;
	localRevision: number;
	remoteRevision: number;
	syncedAt: string;
}

export type BackupDecision = 'same' | 'local-newer' | 'remote-newer' | 'conflict' | 'empty';

export interface BackupSituation {
	decision: BackupDecision;
	local: DriveBackupPayload;
	remote: DriveBackupPayload | null;
	file: DriveFile | null;
}

function authorizationHeaders(accessToken: string) {
	return { Authorization: `Bearer ${accessToken}` };
}

async function assertResponse(response: Response) {
	if (response.ok) return response;
	if (response.status === 401 || response.status === 403) {
		throw new Error('Googleへ再ログインしてDriveバックアップを再開してください。');
	}
	throw new Error('Google Driveとの通信に失敗しました。');
}

export function validateDriveBackupPayload(value: unknown): DriveBackupPayload | null {
	if (!value || typeof value !== 'object') return null;
	const candidate = value as Partial<DriveBackupPayload>;
	if (
		candidate.schemaVersion !== DRIVE_BACKUP_SCHEMA_VERSION
		|| typeof candidate.deviceId !== 'string'
		|| !Number.isInteger(candidate.revision)
		|| Number(candidate.revision) < 0
		|| typeof candidate.exportedAt !== 'string'
		|| Number.isNaN(Date.parse(candidate.exportedAt))
		|| !Array.isArray(candidate.runs)
	) return null;
	const runs = candidate.runs.map(normalizeChecklistRun);
	if (runs.some((run) => !run)) return null;
	return {
		schemaVersion: 1,
		deviceId: candidate.deviceId,
		revision: candidate.revision as number,
		exportedAt: candidate.exportedAt,
		runs: runs as ChecklistRun[],
	};
}

export async function createDriveBackupPayload(): Promise<DriveBackupPayload> {
	return {
		schemaVersion: 1,
		deviceId: await getOrCreateDeviceId(),
		revision: await getPrivateDataRevision(),
		exportedAt: new Date().toISOString(),
		runs: await getPrivateChecklistRuns(),
	};
}

async function findBackupFile(accessToken: string): Promise<DriveFile | null> {
	const query = `name = '${DRIVE_BACKUP_FILE_NAME}' and trashed = false`;
	const url = new URL(`${DRIVE_API}/files`);
	url.searchParams.set('spaces', 'appDataFolder');
	url.searchParams.set('q', query);
	url.searchParams.set('fields', 'files(id,name,modifiedTime)');
	url.searchParams.set('pageSize', '10');
	const response = await assertResponse(await fetch(url, { headers: authorizationHeaders(accessToken) }));
	const body = await response.json() as { files?: DriveFile[] };
	return body.files?.[0] ?? null;
}

async function downloadBackupFile(accessToken: string, fileId: string): Promise<DriveBackupPayload> {
	const response = await assertResponse(await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
		headers: authorizationHeaders(accessToken),
	}));
	const payload = validateDriveBackupPayload(await response.json());
	if (!payload) throw new Error('Google Driveのバックアップ形式が不正です。');
	return payload;
}

async function createBackupFile(accessToken: string, payload: DriveBackupPayload): Promise<DriveFile> {
	const boundary = `likethis-${crypto.randomUUID()}`;
	const metadata = JSON.stringify({ name: DRIVE_BACKUP_FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' });
	const body = [
		`--${boundary}`,
		'Content-Type: application/json; charset=UTF-8',
		'',
		metadata,
		`--${boundary}`,
		'Content-Type: application/json',
		'',
		JSON.stringify(payload),
		`--${boundary}--`,
		'',
	].join('\r\n');
	const response = await assertResponse(await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime`, {
		method: 'POST',
		headers: {
			...authorizationHeaders(accessToken),
			'Content-Type': `multipart/related; boundary=${boundary}`,
		},
		body,
	}));
	return response.json() as Promise<DriveFile>;
}

async function updateBackupFile(accessToken: string, fileId: string, payload: DriveBackupPayload): Promise<DriveFile> {
	const response = await assertResponse(await fetch(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,modifiedTime`, {
		method: 'PATCH',
		headers: { ...authorizationHeaders(accessToken), 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	}));
	return response.json() as Promise<DriveFile>;
}

function equivalentRuns(local: DriveBackupPayload, remote: DriveBackupPayload) {
	const serialize = (payload: DriveBackupPayload) => JSON.stringify(payload.runs
		.slice()
		.sort((a, b) => a.runId.localeCompare(b.runId)));
	return serialize(local) === serialize(remote);
}

export async function inspectDriveBackup(accessToken: string): Promise<BackupSituation> {
	const local = await createDriveBackupPayload();
	const file = await findBackupFile(accessToken);
	if (!file) return { decision: local.runs.length > 0 ? 'local-newer' : 'empty', local, remote: null, file: null };
	const remote = await downloadBackupFile(accessToken, file.id);
	if (equivalentRuns(local, remote)) {
		await recordSync(file.id, local.revision, remote.revision);
		return { decision: 'same', local, remote, file };
	}
	if (local.runs.length === 0 && remote.runs.length > 0) return { decision: 'remote-newer', local, remote, file };
	if (remote.runs.length === 0 && local.runs.length > 0) return { decision: 'local-newer', local, remote, file };

	const previous = await getPrivateSetting<DriveSyncState>(SYNC_STATE_KEY);
	if (previous?.fileId === file.id) {
		const localChanged = local.revision !== previous.localRevision;
		const remoteChanged = remote.revision !== previous.remoteRevision;
		if (localChanged && remoteChanged) return { decision: 'conflict', local, remote, file };
		if (localChanged) return { decision: 'local-newer', local, remote, file };
		if (remoteChanged) return { decision: 'remote-newer', local, remote, file };
	}
	if (local.deviceId === remote.deviceId) {
		return { decision: local.revision > remote.revision ? 'local-newer' : 'remote-newer', local, remote, file };
	}
	return { decision: 'conflict', local, remote, file };
}

async function recordSync(fileId: string, localRevision: number, remoteRevision: number) {
	const syncedAt = new Date().toISOString();
	await setPrivateSetting<DriveSyncState>(SYNC_STATE_KEY, { fileId, localRevision, remoteRevision, syncedAt });
	await setPrivateSetting(LAST_BACKUP_KEY, syncedAt);
	await clearBackupQueue();
}

export async function uploadDriveBackup(accessToken: string, knownFile?: DriveFile | null) {
	const payload = await createDriveBackupPayload();
	if (!validateDriveBackupPayload(payload)) throw new Error('バックアップするデータの形式が不正です。');
	const file = knownFile ?? await findBackupFile(accessToken);
	const savedFile = file
		? await updateBackupFile(accessToken, file.id, payload)
		: await createBackupFile(accessToken, payload);
	await recordSync(savedFile.id, payload.revision, payload.revision);
	return { payload, file: savedFile };
}

export async function restoreDriveBackup(accessToken: string, situation: BackupSituation, mode: 'replace' | 'merge') {
	if (!situation.remote || !situation.file) throw new Error('復元できるバックアップがありません。');
	await importPrivateChecklistRuns(situation.remote.runs, {
		replace: mode === 'replace',
		preserveConflicts: mode === 'merge',
	});
	if (mode === 'merge') return uploadDriveBackup(accessToken, situation.file);
	await recordSync(situation.file.id, await getPrivateDataRevision(), situation.remote.revision);
	return { payload: situation.remote, file: situation.file };
}

export async function getLastDriveBackupAt() {
	return getPrivateSetting<string>(LAST_BACKUP_KEY);
}
