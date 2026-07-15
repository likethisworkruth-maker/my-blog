import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
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

const knowhow = defineCollection({
	loader: glob({ base: './src/content/knowhow', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		checklistId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
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

const checklistItem = z.object({
	id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	label: z.string().min(1),
	defaultPhase: z.enum(['have', 'prepare', 'pack_day']).optional(),
});

const checklists = defineCollection({
	loader: glob({ base: './src/content/checklists', pattern: '**/*.json' }),
	schema: z.object({
		checklistId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
		title: z.string().min(1),
		version: z.number().int().positive(),
		status: z.enum(['draft', 'published']),
		groups: z.array(z.object({
			id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
			label: z.string().min(1),
			items: z.array(checklistItem).min(1),
		})).min(1),
	}),
});

const apps = defineCollection({
	loader: glob({ base: './src/content/apps', pattern: '**/*.{md,mdx}' }),
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

const items = defineCollection({
	loader: glob({ base: './src/content/items', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		icon: z.string(), // Material Symbol name, e.g. "description"
		isFree: z.boolean().default(false),
		categories: z.array(z.string()).optional(),
		childAgeMonths: z.number().optional(),
		order: z.number().default(0), // For sorting tools
		actionText: z.string().optional(),
		actionUrl: z.string().optional(),
		coverImage: z.string().optional(),
	}),
});

export const collections = { logs, knowhow, checklists, apps, items };
