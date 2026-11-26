const LABEL = {
  title: 'الحساب والمزامنة', open: 'الحساب', guest: 'استخدام محلي دون حساب',
  subtitle: 'تقدّمك الدراسي محفوظ؛ سجّل الدخول لمزامنته بين أجهزتك.',
  google: 'المتابعة باستخدام Google', email: 'البريد الإلكتروني', password: 'كلمة المرور',
  login: 'تسجيل الدخول', register: 'إنشاء حساب بالبريد', reset: 'نسيت كلمة المرور؟ أرسل رابط إعادة التعيين',
  close: 'إغلاق', sync: 'مزامنة الآن', merge: 'دمج تقدم الزائر في هذا الحساب',
  verify: 'إرسال رسالة التحقق', signout: 'تسجيل الخروج', delete: 'حذف الحساب',
  confirmDelete: 'نعم، احذف الحساب نهائيًا', cancel: 'إلغاء',
  privacyConfigured: 'الحساب اختياري. عند تسجيل الدخول، تُرسل بيانات الحساب والتقدم إلى Firebase لتوفير المزامنة. يمكنك مواصلة الدراسة محليًا أو نسخ تقدمك احتياطيًا.',
  privacyUnavailable: 'تسجيل الدخول والمزامنة غير مهيّأين في هذا البناء. يبقى تقدمك على هذا الجهاز ويمكنك نسخه احتياطيًا محليًا.',
  free: 'أنت تستخدم التطبيق دون حساب؛ يُحفظ التقدم محليًا على هذا الجهاز.'
};

function element(tag, attrs = {}, text = '') {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') node.className = value;
    else if (key === 'type' || key === 'name' || key === 'autocomplete' || key === 'minLength' || key === 'required' || key === 'dir' || key === 'lang' || key === 'id' || key === 'role' || key === 'ariaLive' || key === 'for') node.setAttribute(key === 'ariaLive' ? 'aria-live' : key === 'for' ? 'for' : key, value === true ? '' : String(value));
    else if (key.startsWith('aria-')) node.setAttribute(key, String(value));
  }
  if (text) node.textContent = text;
  return node;
}

export function accountPrivacyMessage(isConfigured) {
  return LABEL.guest + ' ' + (isConfigured === false ? LABEL.privacyUnavailable : LABEL.privacyConfigured);
}

function makeStateCard(title, description, tone = 'local') {
  const card = element('section', { className: `account-state-card account-state-${tone}` });
  const indicator = element('span', { className: 'account-state-indicator', 'aria-hidden': 'true' });
  const copy = element('div', { className: 'account-state-copy' });
  copy.append(element('strong', {}, title), element('p', {}, description));
  card.append(indicator, copy);
  return card;
}

function formatSyncTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function initializeAccountUI({ service } = {}) {
  if (!service || typeof service.subscribe !== 'function') throw new TypeError('account service with subscribe() is required');
  const topbar = document.querySelector('#profileControlStore') || document.querySelector('.topbar-actions');
  if (!topbar) throw new Error('account control host not found');

  const trigger = element('button', { type: 'button', className: 'icon-button source-button account-trigger', 'aria-haspopup': 'dialog', 'aria-label': LABEL.title });
  trigger.append(element('span', { className: 'account-trigger-icon', 'aria-hidden': 'true' }), element('span', { lang: 'ar' }, LABEL.open));
  const backup = document.getElementById('progressBackupButton');
  if (backup?.parentNode === topbar) topbar.insertBefore(trigger, backup.nextSibling); else topbar.append(trigger);

  const dialog = element('dialog', { className: 'source-dialog account-dialog', dir: 'rtl', lang: 'ar', 'aria-labelledby': 'accountTitle' });
  const shell = element('div', { className: 'account-shell' });
  const header = element('header', { className: 'account-header' });
  const mark = element('span', { className: 'account-brand-mark', 'aria-hidden': 'true' });
  const headingBlock = element('div', { className: 'account-heading-block' });
  const heading = element('h2', { id: 'accountTitle' }, LABEL.title);
  const subtitle = element('p', { className: 'account-subtitle' }, LABEL.subtitle);
  headingBlock.append(heading, subtitle);
  const close = element('button', { type: 'button', className: 'account-close', 'aria-label': LABEL.close }, '×');
  header.append(mark, headingBlock, close);

  const content = element('div', { className: 'account-content' });
  const status = element('p', { className: 'account-status', role: 'status', 'aria-live': 'polite' });
  const error = element('p', { className: 'account-error', role: 'alert', 'aria-live': 'assertive' });

  const googleZone = element('div', { className: 'account-google-zone' });
  const google = element('button', { type: 'button', className: 'account-google' }, LABEL.google);
  google.prepend(element('span', { className: 'account-google-mark', 'aria-hidden': 'true' }, 'G'));
  const divider = element('div', { className: 'account-divider', role: 'separator' }, 'أو باستخدام البريد الإلكتروني');
  googleZone.append(google, divider);

  const form = element('form', { className: 'account-form' });
  const emailLabel = element('label', { for: 'accountEmail' }, LABEL.email);
  const email = element('input', { id: 'accountEmail', type: 'email', name: 'email', autocomplete: 'email', required: true, dir: 'ltr' });
  emailLabel.append(email);
  const passLabel = element('label', { for: 'accountPassword' }, LABEL.password);
  const password = element('input', { id: 'accountPassword', type: 'password', name: 'password', autocomplete: 'current-password', minLength: 8, required: true, dir: 'ltr' });
  passLabel.append(password);
  const authActions = element('div', { className: 'account-auth-actions' });
  const login = element('button', { type: 'submit', className: 'account-primary account-action' }, LABEL.login);
  const register = element('button', { type: 'button', className: 'account-secondary account-action' }, LABEL.register);
  const reset = element('button', { type: 'button', className: 'account-link account-action' }, LABEL.reset);
  authActions.append(login, register, reset);
  form.append(emailLabel, passLabel, authActions);

  const detail = element('section', { className: 'account-detail', 'aria-label': 'حالة الحساب والتقدم' });
  const explanation = element('p', { className: 'account-privacy' }, accountPrivacyMessage(service.isConfigured));
  const actions = element('div', { className: 'account-actions' });
  const confirmed = element('section', { className: 'account-delete-confirm', hidden: true, 'aria-label': 'تأكيد حذف الحساب' });
  const confirmText = element('p', {}, 'سيُحذف حساب Firebase وتقدمه السحابي ونسخة الحساب المحلية على هذا الجهاز. يبقى تقدم الزائر منفصلًا، ولا تُمسح تلقائيًا النسخ المحلية في الأجهزة الأخرى. لا يمكن التراجع عن الحذف السحابي.');
  const confirmDelete = element('button', { type: 'button', className: 'account-danger' }, LABEL.confirmDelete);
  const cancelDelete = element('button', { type: 'button', className: 'account-secondary' }, LABEL.cancel);
  confirmed.append(confirmText, confirmDelete, cancelDelete);
  content.append(status, error, googleZone, form, detail, actions, confirmed);
  shell.append(header, content);
  dialog.append(shell);
  document.body.append(dialog);

  let current = null;
  let busy = false;
  let unsub;
  const allButtons = () => [...dialog.querySelectorAll('button'), ...dialog.querySelectorAll('input')].filter(control => control !== close);
  function announce(message = '', err = '') { status.textContent = message; error.textContent = err; }
  function button(label, fn, cls = 'account-secondary') {
    const b = element('button', { type: 'button', className: cls }, label);
    b.addEventListener('click', () => run(fn));
    actions.append(b);
    return b;
  }
  function render(state = {}) {
    current = state;
    actions.replaceChildren();
    detail.replaceChildren();
    confirmed.hidden = true;
    form.hidden = !!state.user || service.isConfigured === false;
    googleZone.hidden = !!state.user || service.isConfigured === false;
    actions.hidden = !state.user;

    if (state.user) {
      const emailAddress = String(state.user.email || '');
      const displayName = String(state.user.displayName || '').trim();
      const initial = Array.from(displayName || emailAddress || 'ح')[0].toLocaleUpperCase('ar');
      const profile = element('div', { className: 'account-profile-card' });
      const avatar = element('span', { className: 'account-avatar', 'aria-hidden': 'true' }, initial);
      const identity = element('div', { className: 'account-identity' });
      identity.append(element('span', { className: 'account-eyebrow' }, 'الحساب المتصل'));
      if (displayName) identity.append(element('strong', { className: 'account-display-name' }, displayName));
      const who = element('p', { className: 'account-email', dir: 'ltr', lang: 'en' }, emailAddress);
      identity.append(who);
      const verification = element('span', { className: `account-verification${state.user.emailVerified ? ' is-verified' : ' is-unverified'}` }, state.user.emailVerified ? 'بريد موثّق' : 'بحاجة إلى التوثيق');
      profile.append(avatar, identity, verification);
      detail.append(profile);

      if (!state.user.emailVerified) {
        detail.append(makeStateCard('أكمل توثيق بريدك الإلكتروني', 'أرسلنا رابط تحقق إلى بريدك. بعد التوثيق يمكنك مزامنة التقدم بأمان.', 'warning'));
        button(LABEL.verify, () => service.sendVerification(), 'account-primary');
      } else {
        const phases = {
          ready: ['حسابك جاهز للمزامنة', 'يمكنك مزامنة تقدمك الآن أو دمج ما درسته كزائر.', 'ready'],
          syncing: ['جارٍ مزامنة تقدمك', 'حافظ على اتصال الإنترنت حتى يكتمل تحديث بيانات الحساب.', 'syncing'],
          offline: ['أنت غير متصل بالإنترنت', 'يبقى تقدمك محفوظًا على هذا الجهاز؛ ستُستأنف المزامنة عند عودة الاتصال.', 'offline'],
          error: ['تعذرت المزامنة الآن', 'لم يُحذف تقدمك المحلي. تحقق من الاتصال ثم أعد المحاولة.', 'warning']
        };
        const [title, description, tone] = phases[state.phase] || phases.ready;
        detail.append(makeStateCard(title, description, tone));
        const lastSynced = formatSyncTime(state.lastSyncedAt);
        if (lastSynced) detail.append(element('p', { className: 'account-sync-time' }, `آخر مزامنة ناجحة · ${lastSynced}`));
      }
      button(LABEL.sync, () => service.syncNow(), 'account-primary');
      button(LABEL.merge, () => service.importGuestProgress(), 'account-secondary');
      button(LABEL.signout, () => service.signOut(), 'account-tertiary');
      const del = element('button', { type: 'button', className: 'account-danger' }, LABEL.delete);
      del.addEventListener('click', () => { confirmed.hidden = false; confirmDelete.focus(); });
      actions.append(del);
    } else {
      if (service.isConfigured === false) {
        detail.append(makeStateCard('المزامنة السحابية غير مهيّأة', 'يمكنك متابعة الدراسة دون حساب؛ سيبقى تقدمك على هذا الجهاز.', 'warning'));
      } else if (state.phase === 'offline') {
        detail.append(makeStateCard('تدرس دون اتصال', 'تقدمك محفوظ محليًا وسيبقى متاحًا على هذا الجهاز.', 'offline'));
      } else {
        detail.append(makeStateCard('تقدمك محفوظ محليًا', 'أنشئ حسابًا أو سجّل الدخول لمتابعة تقدمك على أجهزتك الأخرى.', 'local'));
      }
      detail.append(explanation);
    }

    announce(state.message || '');
    if (busy) allButtons().forEach(control => { control.disabled = true; });
  }
  async function run(fn) {
    if (busy) return;
    busy = true; allButtons().forEach(control => { control.disabled = true; }); announce();
    try { await fn(); } catch (e) { announce('', e instanceof Error ? e.message : 'تعذر إكمال العملية. حاول مجددًا.'); }
    finally { password.value = ''; busy = false; allButtons().forEach(control => { control.disabled = false; }); }
  }
  google.addEventListener('click', () => run(() => service.signInGoogle()));
  form.addEventListener('submit', event => { event.preventDefault(); run(() => service.signInEmail(email.value.trim(), password.value)); });
  register.addEventListener('click', () => {
    if (!form.reportValidity()) return;
    password.autocomplete = 'new-password';
    run(() => service.registerEmail(email.value.trim(), password.value));
  });
  reset.addEventListener('click', () => {
    if (!email.value.trim() || !email.checkValidity()) { email.focus(); email.reportValidity(); return; }
    run(() => service.sendPasswordReset(email.value.trim()));
  });
  confirmDelete.addEventListener('click', () => run(() => service.deleteAccount()));
  cancelDelete.addEventListener('click', () => { confirmed.hidden = true; });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { password.value = ''; confirmed.hidden = true; trigger.focus(); });
  trigger.addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
    if (current?.user) actions.querySelector('button:not([disabled])')?.focus();
    else if (!form.hidden) email.focus();
    else close.focus();
  });
  unsub = service.subscribe(state => render(state || {}));
  return { button: trigger, dialog, destroy() { unsub?.(); trigger.remove(); dialog.remove(); } };
}
