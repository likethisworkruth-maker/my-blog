type PublishableEntry = {
	data: {
		published: boolean;
	};
};

/**
 * Keep drafts available for local preview and UI regression tests, but omit
 * them from the production build.
 */
export function includeContentInCurrentBuild(entry: PublishableEntry): boolean {
	return !import.meta.env.PROD || entry.data.published;
}
