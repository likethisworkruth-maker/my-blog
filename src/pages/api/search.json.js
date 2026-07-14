import { getCollection } from 'astro:content';

export async function GET() {
  const knowhow = await getCollection('knowhow');
  const apps = await getCollection('apps');
  const items = await getCollection('items');

  const searchIndex = [
    ...knowhow.map((item) => ({
      id: item.id,
      title: item.data.title,
      description: item.data.description,
      url: `/knowhow/${item.id}/`,
      type: 'チェクリスト',
      icon: item.data.icon || 'checklist',
    })),
    ...apps.map((app) => ({
      id: app.id,
      title: app.data.title,
      description: app.data.description,
      url: `/apps/${app.id}/`,
      type: 'アプリ',
      icon: app.data.icon || 'apps',
    })),
    ...items.map((item) => ({
      id: item.id,
      title: item.data.title,
      description: item.data.description,
      url: `/items/${item.id}/`,
      type: 'アイテム',
      icon: item.data.icon || 'toys_and_games',
    })),
  ];

  return new Response(JSON.stringify(searchIndex), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
