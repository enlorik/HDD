export function getDraftStorageKey(contestId, index) {
  return `hdd-codeforces-draft-${contestId}-${index}`;
}

export function buildProblemWorkspaceUrl(problem) {
  const params = new URLSearchParams();

  if (problem.name) {
    params.set('name', problem.name);
  }

  if (problem.rating != null) {
    params.set('rating', String(problem.rating));
  }

  if (problem.tags?.length) {
    params.set('tags', problem.tags.join(','));
  }

  const query = params.toString();
  const basePath = `/problem/${problem.contestId}/${problem.index}`;

  return query ? `${basePath}?${query}` : basePath;
}

export function parseProblemWorkspaceQuery(search) {
  const params = new URLSearchParams(search);
  const rating = params.get('rating');
  const tags = params.get('tags');

  return {
    name: params.get('name') || '',
    rating: rating != null ? Number(rating) : null,
    tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
  };
}
