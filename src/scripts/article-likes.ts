import {
	deleteAnonymousArticleLike,
	getAnonymousArticleLike,
	getAnonymousArticleLikes,
	saveAnonymousArticleLike,
} from './private-db.ts';
import { checkSupabaseHealth, getSupabaseClient, isConnectionError, markSupabaseUnavailable } from './supabase-client.ts';

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
	const isHealthy = await checkSupabaseHealth();
	if (!isHealthy) throw new Error('いいね機能は現在利用できません。');
	const supabase = getSupabaseClient();
	if (!supabase) throw new Error('いいね機能は現在利用できません。');
	try {
		const { data, error } = await supabase.auth.getSession();
		if (error) {
			if (isConnectionError(error)) markSupabaseUnavailable();
			throw error;
		}
		return { supabase, session: data.session };
	} catch (err) {
		if (isConnectionError(err)) markSupabaseUnavailable();
		throw err;
	}
}

async function getPublicLikeCount(slug: string) {
	const isHealthy = await checkSupabaseHealth();
	if (!isHealthy) return 0;
	const supabase = getSupabaseClient();
	if (!supabase) return 0;
	try {
		const { data, error } = await supabase
			.from('likes')
			.select('like_count')
			.eq('slug', slug)
			.maybeSingle();
		if (error) {
			if (isConnectionError(error)) markSupabaseUnavailable();
			return 0;
		}
		return typeof data?.like_count === 'number' ? Math.max(0, data.like_count) : 0;
	} catch (err) {
		if (isConnectionError(err)) markSupabaseUnavailable();
		return 0;
	}
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
	const isHealthy = await checkSupabaseHealth();
	if (!isHealthy) {
		const anonymousLike = await getAnonymousArticleLike(slug);
		return { slug, likeCount: 0, liked: Boolean(anonymousLike) };
	}

	try {
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
	} catch (err) {
		if (isConnectionError(err)) markSupabaseUnavailable();
		const anonymousLike = await getAnonymousArticleLike(slug);
		return { slug, likeCount: 0, liked: Boolean(anonymousLike) };
	}
}

export async function getBatchArticleLikeStates(slugs: string[]): Promise<Map<string, ArticleLikeState>> {
	const result = new Map<string, ArticleLikeState>();
	const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)));
	if (uniqueSlugs.length === 0) return result;

	const localLikes = await getAnonymousArticleLikes();
	const localLikedSet = new Set(localLikes.map((l) => l.slug));

	const isHealthy = await checkSupabaseHealth();
	if (!isHealthy) {
		uniqueSlugs.forEach((slug) => {
			result.set(slug, { slug, likeCount: 0, liked: localLikedSet.has(slug) });
		});
		return result;
	}

	const supabase = getSupabaseClient();
	if (!supabase) {
		uniqueSlugs.forEach((slug) => {
			result.set(slug, { slug, likeCount: 0, liked: localLikedSet.has(slug) });
		});
		return result;
	}

	try {
		const [likedSlugs, publicCountsResponse] = await Promise.all([
			getLikedArticleSlugs(uniqueSlugs),
			supabase.from('likes').select('slug, like_count').in('slug', uniqueSlugs),
		]);

		if (publicCountsResponse.error) {
			if (isConnectionError(publicCountsResponse.error)) markSupabaseUnavailable();
		}

		const countMap = new Map<string, number>();
		(publicCountsResponse.data ?? []).forEach((row: { slug: string; like_count: number }) => {
			countMap.set(row.slug, row.like_count);
		});

		uniqueSlugs.forEach((slug) => {
			result.set(slug, {
				slug,
				likeCount: countMap.get(slug) ?? 0,
				liked: likedSlugs.has(slug),
			});
		});
		return result;
	} catch (err) {
		if (isConnectionError(err)) markSupabaseUnavailable();
		uniqueSlugs.forEach((slug) => {
			result.set(slug, { slug, likeCount: 0, liked: localLikedSet.has(slug) });
		});
		return result;
	}
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
	const localLikes = await getAnonymousArticleLikes();

	const isHealthy = await checkSupabaseHealth();
	if (!isHealthy) {
		const requested = new Set(uniqueSlugs);
		return new Set(localLikes.filter((like) => requested.has(like.slug)).map((like) => like.slug));
	}

	try {
		const { supabase, session } = await getSession();

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
	} catch (err) {
		if (isConnectionError(err)) markSupabaseUnavailable();
		const requested = new Set(uniqueSlugs);
		return new Set(localLikes.filter((like) => requested.has(like.slug)).map((like) => like.slug));
	}
}

export function notifyArticleLikeChanged(state: ArticleLikeState) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent('article-like-changed', { detail: state }));
}
