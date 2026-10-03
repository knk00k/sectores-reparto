export function isWorkspaceResetShortcut(event) {
  return Boolean((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey &&
    (event.code === 'KeyR' || event.key?.toLowerCase() === 'r'));
}
