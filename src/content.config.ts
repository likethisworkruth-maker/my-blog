import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const logs = defineCollection({
	loader: glob({ base: './src/content/logs', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		logNumber: z.string(), // e.g. "001"
		title: z.string(),
		pubDate: z.coerce.date(),
		problem: z.string().optional(),
		createdTool: z.string().optional(),
		result: z.string().optional(),
		categories: z.array(z.string()).optional(),
		childAgeMonths: z.number().optional(),
		coverImage: z.string().optional(),
	}),
});

const tools = defineCollection({
	loader: glob({ base: './src/content/tools', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		icon: z.string(), // Material Symbol name, e.g. "description"
		isFree: z.boolean().default(true),
		categories: z.array(z.string()).optional(),
		childAgeMonths: z.number().optional(),
		order: z.number().default(0), // For sorting tools
		actionText: z.string().optional(),
		actionUrl: z.string().optional(),
		coverImage: z.string().optional(),
	}),
});

export const collections = { logs, tools };
