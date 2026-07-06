import { getCollection } from 'astro:content';

export async function GET() {
  const logs = await getCollection('logs');
  const tools = await getCollection('tools');

  const searchIndex = [
    ...logs.map((log) => ({
      id: log.id,
      title: log.data.title,
      description: `${log.data.problem || ''} ${log.data.result || ''} ${log.data.createdTool || ''}`,
      url: `/logs/${log.id}/`,
      type: '実験ログ',
      icon: 'menu_book',
    })),
    ...tools.map((tool) => ({
      id: tool.id,
      title: tool.data.title,
      description: tool.data.description,
      url: `/tools/${tool.id}/`,
      type: '無料ツール',
      icon: tool.data.icon || 'build',
    })),
  ];

  return new Response(JSON.stringify(searchIndex), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
