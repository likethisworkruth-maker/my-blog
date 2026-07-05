import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context) {
	const logs = await getCollection('logs');
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: logs.map((log) => ({
			title: log.data.title,
			pubDate: log.data.pubDate,
			description: log.data.problem,
			link: `/logs/${log.id}/`,
		})),
	});
}
