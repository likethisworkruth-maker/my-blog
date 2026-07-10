import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

export async function GET(context) {
	const knowhow = await getCollection('knowhow');
	const apps = await getCollection('apps');
	const items = await getCollection('items');
	
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: [
			...knowhow.map((post) => ({
				title: post.data.title,
				pubDate: new Date(),
				description: post.data.description,
				link: `/knowhow/${post.id}/`,
			})),
			...apps.map((post) => ({
				title: post.data.title,
				pubDate: new Date(),
				description: post.data.description,
				link: `/apps/${post.id}/`,
			})),
			...items.map((post) => ({
				title: post.data.title,
				pubDate: new Date(),
				description: post.data.description,
				link: `/items/${post.id}/`,
			})),
		],
	});
}
