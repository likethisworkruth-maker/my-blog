import {
	deleteAnonymousArticleLike,
	getAnonymousArticleLike,
	getAnonymousArticleLikes,
	saveAnonymousArticleLike,
} from './private-db.ts';
import { getSupabaseClient } from './supabase-client.ts';

export interface ArticleLikeState {
	slug: string;
	likeCount: number;
	liked: boolean;
}

interface LikeRpcResult {
	slug?: unknown;
	like_count?: unknown;
	liked?: unknown;
}

function normalizeLikeResult(value: unknown, slug: string): ArticleLikeState {
	const result = value && typeof value === 'object' ? value as LikeRpcResult : {};
	return {
		slug: typeof result.slug === 'string' ? result.slug : slug,
		likeCount: typeof result.like_count === 'number' && Number.isFinite(result.like_count)
			? Math.max(0, result.like_count)
			: 0,
		liked: result.liked === true,
	};
}

async function getSession() {
	const supabase = getSupabaseClient();
	if (!supabase) throw new Error('いいね機能は現在利用できません。');
	const { data, error } = await supabase.auth.getSession();
	if (error) throw error;
	return { supabase, session: data.session };
}

async function getPublicLikeCount(slug: string) {
	const supabase = getSupabaseClient();
	if (!supabase) throw new Error('いいね機能は現在利用できません。');
	const { data, error } = await supabase
		.from('likes')
		.select('like_count')
		.eq('slug', slug)
		.maybeSingle();
	if (error) throw error;
	return typeof data?.like_count === 'number' ? Math.max(0, data.like_count) : 0;
}

export function createAnonymousLikeToken(randomSource: Pick<Crypto, 'getRandomValues'> = crypto) {
	const bytes = randomSource.getRandomValues(new Uint8Array(32));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

async function claimAnonymousLike(
	slug: string,
	token: string,
	supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
) {
	const { data, error } = await supabase.rpc('claim_anonymous_like', {
		p_slug: slug,
		p_token: token,
	});
	if (error) throw error;
	await deleteAnonymousArticleLike(slug);
	return normalizeLikeResult(data, slug);
}

export async function getCurrentArticleLikeState(slug: string): Promise<ArticleLikeState> {
	const { supabase, session } = await getSession();
	if (session?.user) {
		const anonymousLike = await getAnonymousArticleLike(slug);
		if (anonymousLike) await claimAnonymousLike(slug, anonymousLike.token, supabase);
		const { data, error } = await supabase.rpc('get_authenticated_like_state', { p_slug: slug });
		if (error) throw error;
		return normalizeLikeResult(data, slug);
	}

	const [likeCount, anonymousLike] = await Promise.all([
		getPublicLikeCount(slug),
		getAnonymousArticleLike(slug),
	]);
	return { slug, likeCount, liked: Boolean(anonymousLike) };
}

export async function setArticleLikeState(slug: string, liked: boolean): Promise<ArticleLikeState> {
	const { supabase, session } = await getSession();
	if (session?.user) {
		const { data, error } = await supabase.rpc('set_authenticated_like', {
			p_slug: slug,
			p_liked: liked,
		});
		if (error) throw error;
		return normalizeLikeResult(data, slug);
	}

	const existing = await getAnonymousArticleLike(slug);
	if (!liked && !existing) {
		return { slug, likeCount: await getPublicLikeCount(slug), liked: false };
	}

	if (liked) {
		const token = existing?.token ?? createAnonymousLikeToken();
		const { data, error } = await supabase.rpc('add_anonymous_like', {
			p_slug: slug,
			p_token: token,
		});
		if (error) throw error;
		const now = new Date().toISOString();
		await saveAnonymousArticleLike({
			slug,
			token,
			liked: true,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
		});
		return normalizeLikeResult(data, slug);
	}

	const { data, error } = await supabase.rpc('remove_anonymous_like', {
		p_slug: slug,
		p_token: existing!.token,
	});
	if (error) throw error;
	await deleteAnonymousArticleLike(slug);
	return normalizeLikeResult(data, slug);
}

export async function getLikedArticleSlugs(slugs: string[]) {
	const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean))).slice(0, 200);
	const { supabase, session } = await getSession();
	const localLikes = await getAnonymousArticleLikes();

	if (!session?.user) {
		const requested = new Set(uniqueSlugs);
		return new Set(localLikes.filter((like) => requested.has(like.slug)).map((like) => like.slug));
	}

	const requested = new Set(uniqueSlugs);
	const claimable = localLikes.filter((like) => requested.has(like.slug));
	await Promise.allSettled(
		claimable.map((like) => claimAnonymousLike(like.slug, like.token, supabase)),
	);

	const { data, error } = await supabase.rpc('get_authenticated_like_slugs', {
		p_slugs: uniqueSlugs,
	});
	if (error) throw error;
	return new Set(Array.isArray(data) ? data.filter((value): value is string => typeof value === 'string') : []);
}

export function notifyArticleLikeChanged(state: ArticleLikeState) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent('article-like-changed', { detail: state }));
}
