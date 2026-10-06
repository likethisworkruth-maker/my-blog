export interface KnowhowSortMetadata {
	childAgeMonths?: number | null;
	recommended?: boolean;
	timelineOrder?: number | null;
}

export interface KnowhowSortEntry extends KnowhowSortMetadata {
	id: string;
	data?: KnowhowSortMetadata;
}

export type KnowhowAgeSort = 'age' | 'recommend';

const getMetadata = (entry: KnowhowSortEntry): KnowhowSortMetadata => entry.data ?? entry;

const compareNumber = (left: number, right: number) => (left < right ? -1 : left > right ? 1 : 0);

const validAge = (age: number | null | undefined) => (
	typeof age === 'number' && Number.isFinite(age) && age >= 0 ? age : Number.POSITIVE_INFINITY
);

export const compareKnowhowByAge = (left: KnowhowSortEntry, right: KnowhowSortEntry) => {
	const leftData = getMetadata(left);
	const rightData = getMetadata(right);
	const ageComparison = compareNumber(validAge(leftData.childAgeMonths), validAge(rightData.childAgeMonths));
	if (ageComparison !== 0) return ageComparison;

	const timelineComparison = compareNumber(
		leftData.timelineOrder ?? Number.MAX_SAFE_INTEGER,
		rightData.timelineOrder ?? Number.MAX_SAFE_INTEGER,
	);
	if (timelineComparison !== 0) return timelineComparison;
	return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
};

export const compareKnowhowByRecommendation = (left: KnowhowSortEntry, right: KnowhowSortEntry) => {
	const leftRecommended = getMetadata(left).recommended === true;
	const rightRecommended = getMetadata(right).recommended === true;
	if (leftRecommended !== rightRecommended) return leftRecommended ? -1 : 1;
	return compareKnowhowByAge(left, right);
};

export const sortKnowhowEntries = <T extends KnowhowSortEntry>(
	entries: readonly T[],
	sort: KnowhowAgeSort,
): T[] => [...entries].sort(sort === 'recommend' ? compareKnowhowByRecommendation : compareKnowhowByAge);
