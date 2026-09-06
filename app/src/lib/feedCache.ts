import type { QueryClient } from '@tanstack/react-query';

// Shared helpers to keep the feed's react-query cache as the single source of
// truth for post data. Interactions (like, react, delete, block) patch the
// cache directly here so that a post's state survives being unmounted and
// remounted by list virtualization — without this, a card that scrolls out of
// the virtualization window and back in re-reads its stale original props.

type PostUpdater = (post: any) => any;
type PostPredicate = (post: any) => boolean;

function updateFeedPages(queryClient: QueryClient, mapPage: (page: any) => any) {
  queryClient.setQueriesData({ queryKey: ['feed'] }, (oldData: any) => {
    if (!oldData?.pages) return oldData;
    return { ...oldData, pages: oldData.pages.map(mapPage) };
  });
}

export function patchPostInFeedCaches(queryClient: QueryClient, postId: string, updater: PostUpdater) {
  updateFeedPages(queryClient, (page: any) => ({
    ...page,
    items: (page.items || []).map((p: any) => (p._id === postId ? updater(p) : p)),
  }));
}

export function removeFromFeedCaches(queryClient: QueryClient, predicate: PostPredicate) {
  updateFeedPages(queryClient, (page: any) => ({
    ...page,
    items: (page.items || []).filter((p: any) => !predicate(p)),
  }));
}
