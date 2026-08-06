export const BROWSER_STORAGE_MUTATION_LOCK_NAME =
  "bodam.preview.storage-mutation.v1";

export interface BrowserLockManager {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

const mutationTails = new WeakMap<object, Promise<void>>();

function currentLockManager(): BrowserLockManager | undefined {
  if (typeof navigator === "undefined") return undefined;
  const lockManager = navigator.locks;
  return lockManager === undefined || lockManager === null
    ? undefined
    : lockManager;
}

async function runWithOriginLock<T>(
  operation: () => Promise<T>,
  lockManager: BrowserLockManager | undefined,
): Promise<T> {
  if (lockManager === undefined) return operation();
  return lockManager.request(BROWSER_STORAGE_MUTATION_LOCK_NAME, operation);
}

export function withBrowserStorageMutation<T>(
  storageIdentity: object,
  operation: () => Promise<T>,
  lockManager: BrowserLockManager | undefined = currentLockManager(),
): Promise<T> {
  const previous = mutationTails.get(storageIdentity) ?? Promise.resolve();
  const result = previous.then(
    () => runWithOriginLock(operation, lockManager),
    () => runWithOriginLock(operation, lockManager),
  );
  mutationTails.set(
    storageIdentity,
    result.then(() => undefined, () => undefined),
  );
  return result;
}
