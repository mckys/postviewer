// Custom styled alert/confirm dialogs

// Store reference to original functions
const originalAlert = window.alert;
const originalConfirm = window.confirm;

export function initCustomAlerts() {
  // Override alert
  window.alert = (message?: string) => {
    showCustomAlert(message || '');
  };

  // Override confirm
  window.confirm = (message?: string): boolean => {
    return showCustomConfirm(message || '');
  };
}

function showCustomAlert(message: string) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] animate-in fade-in duration-200';

  const dialog = document.createElement('div');
  dialog.className = 'bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200';

  dialog.innerHTML = `
    <div class="mb-6 text-gray-900 text-base leading-relaxed whitespace-pre-wrap">${escapeHtml(message)}</div>
    <button class="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors font-medium">
      OK
    </button>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const button = dialog.querySelector('button');
  button?.addEventListener('click', () => {
    overlay.remove();
  });

  // Focus button
  button?.focus();

  // Close on escape
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function showCustomConfirm(message: string): boolean {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] animate-in fade-in duration-200';

  const dialog = document.createElement('div');
  dialog.className = 'bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200';

  dialog.innerHTML = `
    <div class="mb-6 text-gray-900 text-base leading-relaxed whitespace-pre-wrap">${escapeHtml(message)}</div>
    <div class="flex gap-3">
      <button data-action="cancel" class="flex-1 bg-gray-200 text-gray-900 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors font-medium">
        Cancel
      </button>
      <button data-action="confirm" class="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors font-medium">
        OK
      </button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  let result = false;
  let resolved = false;

  const confirmButton = dialog.querySelector('[data-action="confirm"]');
  const cancelButton = dialog.querySelector('[data-action="cancel"]');

  const cleanup = () => {
    if (resolved) return;
    resolved = true;
    overlay.remove();
  };

  confirmButton?.addEventListener('click', () => {
    result = true;
    cleanup();
  });

  cancelButton?.addEventListener('click', () => {
    result = false;
    cleanup();
  });

  // Close on escape
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      result = false;
      cleanup();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Focus confirm button
  if (confirmButton instanceof HTMLElement) {
    confirmButton.focus();
  }

  // Synchronous return - this won't work for custom modal!
  // We need to use a different approach
  // For now, fall back to original confirm
  overlay.remove();
  return originalConfirm(message);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
