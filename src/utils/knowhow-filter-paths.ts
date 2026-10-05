import { includeContentInCurrentBuild } from './content-publication';

type KnowhowFilterEntry = {
	data: {
		published: boolean;
		phases: string[];
		scenes: string[];
	};
};

const developmentPhases = ['pregnancy', '0-3m', '4-6m', '7-11m', '1y-plus'];
const developmentScenes = ['outing', 'medical', 'daily', 'travel', 'nursery', 'disaster'];
const sceneSlugByLabel: Record<string, string> = {
	'おでかけ': 'outing',
	'病院・健診': 'medical',
	'毎日の準備': 'daily',
	'帰省・旅行': 'travel',
	'保育園': 'nursery',
	'防災': 'disaster',
};

function getVisibleEntries(entries: KnowhowFilterEntry[]) {
	return entries.filter(includeContentInCurrentBuild);
}

function getSceneSlug(scene: string) {
	return sceneSlugByLabel[scene] ?? scene;
}

export function getKnowhowPhaseFilterPaths(entries: KnowhowFilterEntry[]) {
	const visibleEntries = getVisibleEntries(entries);
	const phases = new Set(visibleEntries.flatMap((entry) => entry.data.phases));
	const phaseScenes = new Map<string, Set<string>>();

	for (const entry of visibleEntries) {
		for (const phase of entry.data.phases) {
			const scenes = phaseScenes.get(phase) ?? new Set<string>();
			entry.data.scenes.forEach((scene) => scenes.add(getSceneSlug(scene)));
			phaseScenes.set(phase, scenes);
		}
	}

	if (!import.meta.env.PROD) {
		developmentPhases.forEach((phase) => phases.add(phase));
		for (const phase of developmentPhases) {
			phaseScenes.set(phase, new Set(developmentScenes));
		}
	}

	return Array.from(phases).flatMap((phase) => [
		{ params: { filters: phase } },
		...Array.from(phaseScenes.get(phase) ?? []).map((scene) => ({
			params: { filters: `${phase}/scene/${scene}` },
		})),
	]);
}

export function getKnowhowSceneFilterPaths(entries: KnowhowFilterEntry[]) {
	const scenes = new Set(
		getVisibleEntries(entries).flatMap((entry) => entry.data.scenes.map(getSceneSlug)),
	);
	if (!import.meta.env.PROD) developmentScenes.forEach((scene) => scenes.add(scene));
	return Array.from(scenes).map((scene) => ({ params: { scene } }));
}
