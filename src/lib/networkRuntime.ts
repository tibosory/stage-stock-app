let isOnlineRuntime = true;
let initialized = false;

export function getIsOnlineRuntime(): boolean {
  return isOnlineRuntime;
}

export function isOnlineRuntimeInitialized(): boolean {
  return initialized;
}

export function setIsOnlineRuntime(next: boolean): void {
  isOnlineRuntime = !!next;
  initialized = true;
}
