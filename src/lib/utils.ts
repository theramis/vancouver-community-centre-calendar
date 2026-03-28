export function compressIds(ids: number[]): string {
  if (ids.length === 0) return "";
  const sortedIds = [...ids].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sortedIds[0];
  let end = sortedIds[0];

  for (let i = 1; i < sortedIds.length; i++) {
    if (sortedIds[i] === end + 1) {
      end = sortedIds[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sortedIds[i];
      end = sortedIds[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(',');
}
