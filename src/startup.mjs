export async function loadCourseData({fetchImpl = globalThis.fetch, timeoutMs = 15000} = {}) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Connessione troppo lenta. Attendi la verifica del sito e riprova. / الاتصال بطيء أو عالق. انتظر انتهاء التحقق من الموقع ثم أعد المحاولة.');
      error.code = 'course_timeout';
      reject(error);
      controller.abort();
    }, timeoutMs);
  });
  const paths = ['/data/questions.json', '/data/lessons.json', '/data/topic-labels.json', '/data/similar-groups.json'];
  const requests = Promise.all(paths.map(async path => {
    const response = await fetchImpl(path, {signal: controller.signal, credentials: 'same-origin', cache: 'no-store'});
    if (response.headers.get('cf-mitigated') === 'challenge' || response.status === 403) {
      throw new Error('La protezione del sito ha bloccato un file. Completa la verifica e riprova. / حجبت حماية الموقع أحد الملفات. أكمل التحقق ثم أعد المحاولة.');
    }
    if (!response.ok) throw new Error(`File del corso non disponibile (HTTP ${response.status}). / ملف المنهج غير متاح (HTTP ${response.status}).`);
    if (!/^(application\/(?:[a-z0-9.+-]*\+)?json)(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
      throw new Error('Il server ha restituito una pagina invece dei dati del corso. / أعاد الخادم صفحة بدل بيانات المنهج.');
    }
    try {
      const rawText = await response.text();
      return {path, rawText, data: JSON.parse(rawText)};
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error('Dati del corso non validi. Riprova tra poco. / بيانات المنهج غير صالحة. أعد المحاولة بعد قليل.');
    }
  }));
  try {
    const loaded = await Promise.race([requests, timeout]);
    const [bankFile, lessonFile, labelsFile, similarFile] = loaded;
    const bank = bankFile?.data;
    const lessons = lessonFile?.data;
    const labels = labelsFile?.data;
    const similar = similarFile?.data;
    if (!bank || !Array.isArray(bank.questions) || bank.questions.length === 0 || bank.count !== bank.questions.length ||
        !lessons || !Array.isArray(lessons.modules) || lessons.module_count !== lessons.modules.length ||
        !labels || typeof labels !== 'object' || Array.isArray(labels) || Object.keys(labels).length === 0 ||
        !similar || similar.schema_version !== 2 || !Array.isArray(similar.groups) || similar.group_count !== similar.groups.length ||
        similar.question_count !== bank.questions.length || !/^[a-f0-9]{64}$/.test(similar.question_bank_sha256 || '')) {
      const error = new Error('I file del corso sono incompleti o non compatibili. / ملفات المنهج ناقصة أو غير متوافقة.');
      error.code = 'course_integrity';
      throw error;
    }
    if (!globalThis.crypto?.subtle || typeof TextEncoder !== 'function') {
      const error = new Error('Il controllo d’integrità non è disponibile sul dispositivo. / التحقق من سلامة الملفات غير متاح على هذا الجهاز.');
      error.code = 'course_integrity';
      throw error;
    }
    const sourceBytes = new TextEncoder().encode(bankFile.rawText);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', sourceBytes);
    const fingerprint = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    if (fingerprint !== similar.question_bank_sha256) {
      const error = new Error('إصدار بنك الأسئلة لا يطابق فهرس الصياغات القريبة. أعد تحميل الملفات وتحقق من اتصال الإنترنت.');
      error.code = 'course_integrity';
      throw error;
    }
    return loaded.map(file => file.data);
  }
  catch (error) {
    if (error.code === 'course_timeout' || error.code === 'course_integrity' || error.message?.includes(' / ')) throw error;
    throw new Error('Connessione interrotta. Controlla la rete e riprova. / انقطع الاتصال. تحقق من الشبكة ثم أعد المحاولة.');
  }
  finally { clearTimeout(timer); controller.abort(); }
}
