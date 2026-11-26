const configuredNote = 'Puoi continuare con Google o studiare come ospite. يمكنك المتابعة باستخدام Google أو الدراسة كضيف.';
const unavailableNote = 'Accesso non configurato in questa build. تسجيل الدخول غير مهيّأ في هذا البناء.';
const workingNote = 'Accesso in corso… جارٍ تسجيل الدخول…';
const verifyingNote = 'Richiesta inviata; verifica dell’account… أُرسِل طلب الدخول؛ جارٍ التحقق من الحساب…';

export function initializeWelcomeAccount({ service, dialog, button, note }) {
  if (!service || !dialog || !button || !note) return { isSignedIn: () => false, destroy() {} };
  let busy = false;
  let signedIn = false;
  function render(state = {}) {
    signedIn = !!state.user;
    button.disabled = busy || !service.isConfigured || signedIn;
    button.hidden = signedIn;
    if (!busy) note.textContent = service.isConfigured ? configuredNote : unavailableNote;
    if (signedIn && dialog.open) dialog.close();
  }
  const unsubscribe = service.subscribe(render);
  async function signIn() {
    if (busy || !service.isConfigured || signedIn) return;
    busy = true;
    button.disabled = true;
    note.textContent = workingNote;
    try {
      await service.signInGoogle();
      if (!signedIn) note.textContent = verifyingNote;
    } catch (error) {
      note.textContent = error instanceof Error ? error.message : 'تعذر تسجيل الدخول. يمكنك المحاولة مجددًا أو المتابعة كضيف.';
    } finally {
      busy = false;
      button.disabled = !service.isConfigured || signedIn;
    }
  }
  button.addEventListener('click', signIn);
  return {
    isSignedIn: () => signedIn,
    destroy() { unsubscribe?.(); button.removeEventListener('click', signIn); }
  };
}
