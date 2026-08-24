/* =====================================================================
   XYZSKOR · GÜNDEM SOHBETİ
   Doğrulanmış kullanıcıların gündem odalarında sohbet ettiği panel.
   - Veri katmanı: Supabase (chat_rooms / chat_messages) + Realtime
   - Güvenlik: tüm kurallar sunucuda (RLS + trigger + RPC). Buradaki
     kontroller yalnızca kullanıcıya hızlı geri bildirim içindir.
   - Bağımlılık: data.js (sb, getCurrentUser, escapeHTML, SUPABASE_READY)
   ===================================================================== */

const CHAT_PAGE_SIZE = 50;
const CHAT_BODY_LIMIT = 500;
const CHAT_SEND_COOLDOWN_MS = 3000;
const CHAT_LEAGUE_ALLOWLIST = new Set(['super-lig','premier-league','la-liga','bundesliga','serie-a']);

const chatState = {
  open: false,
  ready: false,
  loading: false,
  rooms: [],
  activeRoomId: null,
  messages: [],
  channel: null,
  lastSentAt: 0,
  muted: null,
  error: null,
  unread: 0,
  isModerator: false,
  pendingScroll: true,
  authUserId: null,
};

/* ---------- yardımcılar ---------- */

function chatEscape(value){
  // data.js escapeHTML'i mevcut; yoksa güvenli tarafta kal.
  if(typeof escapeHTML === 'function') return escapeHTML(value);
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function chatTeamClass(team){
  const map = { 'Galatasaray':'gs', 'Fenerbahçe':'fb', 'Beşiktaş':'bjk', 'Trabzonspor':'ts' };
  return map[team] || 'other';
}

function chatTimeLabel(value){
  if(!value) return '';
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  if(diff < 60000) return 'şimdi';
  if(diff < 3600000) return `${Math.floor(diff/60000)} dk`;
  if(diff < 86400000) return date.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
  return date.toLocaleDateString('tr-TR',{day:'2-digit',month:'short'});
}

function chatActiveRoom(){
  return chatState.rooms.find((room) => room.id === chatState.activeRoomId) || null;
}

/* Aktif lig değiştiğinde ilgili odayı öne çıkarmak için. */
function chatRoomForLeague(leagueKey){
  if(!CHAT_LEAGUE_ALLOWLIST.has(String(leagueKey || ''))) return null;
  return chatState.rooms.find((room) => room.league_key === leagueKey) || null;
}

function chatRoomIsInCurrentScope(room){
  return room?.kind !== 'league' || CHAT_LEAGUE_ALLOWLIST.has(String(room?.league_key || ''));
}

/* ---------- veri katmanı ---------- */

async function chatLoadRooms(){
  const { data, error } = await sb.from('chat_rooms')
    .select('id,slug,title,topic,kind,league_key,match_id,is_locked,min_account_state,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending:true });
  if(error) throw error;
  // Database migration is authoritative; this filter is a fail-safe for stale
  // replicas/caches so retired competition rooms never leak back into the UI.
  chatState.rooms = (data || []).filter(chatRoomIsInCurrentScope);
  return chatState.rooms;
}

async function chatLoadMessages(roomId){
  const { data, error } = await sb.from('chat_messages')
    .select('id,room_id,user_id,body,author_name,author_team,author_verified,reply_to,deleted_at,deleted_reason,report_count,created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending:false })
    .limit(CHAT_PAGE_SIZE);
  if(error) throw error;
  // En eski üstte olacak şekilde çevir.
  chatState.messages = (data || []).slice().reverse();
  return chatState.messages;
}

async function chatCheckMute(){
  const user = getCurrentUser();
  if(!user?.id){ chatState.muted = null; return null; }
  const { data } = await sb.from('chat_mutes').select('muted_until,reason').eq('user_id', user.id).maybeSingle();
  if(!data){ chatState.muted = null; return null; }
  const until = data.muted_until ? new Date(data.muted_until).getTime() : null;
  if(until !== null && until <= Date.now()){ chatState.muted = null; return null; }
  chatState.muted = { until, reason: data.reason || null };
  return chatState.muted;
}

async function chatDetectModerator(){
  // is_editorial_admin RPC'si yoksa sessizce false kalır.
  try{
    const { data, error } = await sb.rpc('is_editorial_admin', { required_roles: null });
    chatState.isModerator = !error && data === true;
  }catch(_error){
    chatState.isModerator = false;
  }
  return chatState.isModerator;
}

async function chatSendMessage(body){
  const user = getCurrentUser();
  if(!user?.id) return { ok:false, error:'Sohbete katılmak için giriş yapmalısın.' };
  const text = String(body || '').trim();
  if(!text) return { ok:false, error:'Mesaj boş olamaz.' };
  if(text.length > CHAT_BODY_LIMIT) return { ok:false, error:`Mesaj en fazla ${CHAT_BODY_LIMIT} karakter olabilir.` };
  const sinceLast = Date.now() - chatState.lastSentAt;
  if(sinceLast < CHAT_SEND_COOLDOWN_MS) return { ok:false, error:'Çok hızlı yazıyorsun, birkaç saniye bekle.' };
  const roomId = chatState.activeRoomId;
  if(!roomId) return { ok:false, error:'Önce bir oda seç.' };

  const { data, error } = await sb.from('chat_messages')
    .insert({ room_id: roomId, user_id: user.id, body: text })
    .select('id,room_id,user_id,body,author_name,author_team,author_verified,reply_to,deleted_at,report_count,created_at')
    .single();

  if(error){
    // Sunucu tarafı trigger mesajları Türkçe; doğrudan gösterilebilir.
    return { ok:false, error: error.message || 'Mesaj gönderilemedi.' };
  }
  chatState.lastSentAt = Date.now();
  // Realtime aynı mesajı da getirecek; çift eklemeyi id ile önlüyoruz.
  chatUpsertMessage(data);
  chatState.pendingScroll = true;
  renderChatMessages();
  return { ok:true };
}

async function chatReportMessage(messageId){
  const { data, error } = await sb.rpc('report_chat_message', { p_message_id: messageId, p_reason:'user_report' });
  if(error) return { ok:false, error: error.message || 'Rapor gönderilemedi.' };
  return { ok:true, data };
}

async function chatModerate(messageId, action){
  const { data, error } = await sb.rpc('moderate_chat_message', { p_message_id: messageId, p_action: action });
  if(error) return { ok:false, error: error.message || 'İşlem yapılamadı.' };
  return { ok:true, data };
}

/* ---------- realtime ---------- */

function chatUpsertMessage(row){
  if(!row?.id) return;
  if(chatState.activeRoomId && row.room_id !== chatState.activeRoomId) return;
  const index = chatState.messages.findIndex((message) => message.id === row.id);
  if(index >= 0) chatState.messages[index] = { ...chatState.messages[index], ...row };
  else chatState.messages.push(row);
  if(chatState.messages.length > CHAT_PAGE_SIZE * 3) chatState.messages = chatState.messages.slice(-CHAT_PAGE_SIZE * 2);
}

function chatUnsubscribe(){
  if(chatState.channel){
    try{ sb.removeChannel(chatState.channel); }catch(_error){}
    chatState.channel = null;
  }
}

function chatSubscribe(roomId){
  chatUnsubscribe();
  if(!SUPABASE_READY || !roomId) return;
  try{
    chatState.channel = sb.channel(`chat:${roomId}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'chat_messages', filter:`room_id=eq.${roomId}` }, (payload) => {
        chatUpsertMessage(payload.new);
        // Panel kapalıysa okunmamış sayacı artır.
        if(!chatState.open) chatState.unread += 1;
        chatState.pendingScroll = chatIsScrolledToBottom();
        renderChatMessages();
        renderChatLauncher();
      })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'chat_messages', filter:`room_id=eq.${roomId}` }, (payload) => {
        // Silme yumuşak yapıldığı için UPDATE olarak gelir.
        chatUpsertMessage(payload.new);
        renderChatMessages();
      })
      .subscribe();
  }catch(error){
    console.warn('[XYZSkor] Sohbet realtime aboneliği kurulamadı:', error?.message || error);
  }
}

/* ---------- render ---------- */

function chatIsScrolledToBottom(){
  const list = document.getElementById('chatMessageList');
  if(!list) return true;
  return list.scrollHeight - list.scrollTop - list.clientHeight < 80;
}

function renderChatLauncher(){
  const launcher = document.getElementById('chatLauncher');
  if(!launcher) return;
  const badge = chatState.unread > 0 ? `<span class="chat-launcher-badge">${chatState.unread > 9 ? '9+' : chatState.unread}</span>` : '';
  launcher.innerHTML = `<span class="chat-launcher-icon" aria-hidden="true">💬</span><span class="chat-launcher-label">Gündem Sohbeti</span>${badge}`;
  launcher.setAttribute('aria-expanded', String(chatState.open));
  launcher.classList.toggle('has-unread', chatState.unread > 0);
}

function renderChatRooms(){
  const nav = document.getElementById('chatRoomList');
  if(!nav) return;
  if(!chatState.rooms.length){
    nav.innerHTML = '<div class="chat-rooms-empty">Sohbet odaları yükleniyor…</div>';
    return;
  }
  nav.innerHTML = chatState.rooms.map((room) => `
    <button class="chat-room-chip ${room.id===chatState.activeRoomId?'active':''}" type="button"
      data-chat-room="${chatEscape(room.id)}" title="${chatEscape(room.topic || room.title)}">
      ${chatEscape(room.title)}${room.is_locked?'<span class="chat-room-lock" aria-label="Kilitli">🔒</span>':''}
    </button>`).join('');
}

function chatMessageHTML(message){
  const user = getCurrentUser();
  const own = user?.id && message.user_id === user.id;
  const deleted = Boolean(message.deleted_at);
  const teamClass = chatTeamClass(message.author_team);

  if(deleted){
    const reason = message.deleted_reason === 'auto_hidden_report_threshold'
      ? 'Çok sayıda rapor nedeniyle gizlendi, inceleniyor.'
      : 'Bu mesaj moderasyon tarafından kaldırıldı.';
    return `<article class="chat-message is-deleted" data-message-id="${chatEscape(message.id)}">
      <div class="chat-message-deleted">${chatEscape(reason)}${own?' <em>(senin mesajın)</em>':''}
        ${chatState.isModerator?`<button class="chat-mod-action" type="button" data-chat-restore="${chatEscape(message.id)}">Geri al</button>`:''}
      </div>
    </article>`;
  }

  const initials = String(message.author_name || '?').trim().slice(0,2).toLocaleUpperCase('tr-TR');
  const verified = message.author_verified
    ? '<span class="chat-verified" title="Doğrulanmış hesap" aria-label="Doğrulanmış hesap">✓</span>'
    : '';
  const actions = [];
  if(!own) actions.push(`<button class="chat-msg-action" type="button" data-chat-report="${chatEscape(message.id)}" title="Bildir">⚑</button>`);
  if(chatState.isModerator) actions.push(`<button class="chat-msg-action danger" type="button" data-chat-delete="${chatEscape(message.id)}" title="Kaldır">✕</button>`);

  return `<article class="chat-message ${own?'is-own':''}" data-message-id="${chatEscape(message.id)}">
    <span class="chat-avatar team-${teamClass}" aria-hidden="true">${chatEscape(initials)}</span>
    <div class="chat-message-body">
      <header class="chat-message-head">
        <strong>${chatEscape(message.author_name || 'Taraftar')}</strong>${verified}
        <span class="chat-team-tag team-${teamClass}">${chatEscape(message.author_team || '')}</span>
        <time datetime="${chatEscape(message.created_at || '')}">${chatEscape(chatTimeLabel(message.created_at))}</time>
        ${actions.length?`<span class="chat-message-actions">${actions.join('')}</span>`:''}
      </header>
      <p class="chat-message-text">${chatEscape(message.body)}</p>
    </div>
  </article>`;
}

function renderChatMessages(){
  const list = document.getElementById('chatMessageList');
  if(!list) return;
  const wasAtBottom = chatState.pendingScroll || chatIsScrolledToBottom();

  if(chatState.loading){
    list.innerHTML = `<div class="chat-loading">${[1,2,3].map(()=>'<div class="skeleton skeleton-row chat-skeleton"></div>').join('')}</div>`;
    return;
  }
  if(chatState.error){
    list.innerHTML = `<div class="chat-state-card is-error"><strong>Sohbet yüklenemedi</strong><p>${chatEscape(chatState.error)}</p>
      <button class="btn ghost" type="button" id="chatRetryBtn">Tekrar dene</button></div>`;
    return;
  }
  // Servis hiç kurulamadıysa "mesaj yok" demek yanıltıcı olur; gerçek nedeni söyle.
  if(!SUPABASE_READY){
    list.innerHTML = `<div class="chat-state-card is-error"><strong>Sohbet şu anda kullanılamıyor</strong>
      <p>Hesap servisine ulaşılamadığı için odalar ve mesajlar yüklenemedi. Bağlantı geri geldiğinde sohbet otomatik açılacak.</p></div>`;
    return;
  }
  const visible = chatState.messages;
  if(!visible.length){
    const room = chatActiveRoom();
    list.innerHTML = `<div class="chat-state-card"><strong>Bu odada henüz mesaj yok</strong>
      <p>${chatEscape(room?.topic || 'İlk mesajı sen yaz, gündemi başlat.')}</p></div>`;
    return;
  }
  list.innerHTML = visible.map(chatMessageHTML).join('');
  if(wasAtBottom) list.scrollTop = list.scrollHeight;
  chatState.pendingScroll = false;
}

function renderChatComposer(){
  const composer = document.getElementById('chatComposer');
  if(!composer) return;
  const user = getCurrentUser();
  const room = chatActiveRoom();

  if(!SUPABASE_READY){
    composer.innerHTML = `<div class="chat-composer-notice">Hesap servisine şu anda ulaşılamıyor; sohbet geçici olarak salt okunur.</div>`;
    return;
  }
  if(!user?.id){
    composer.innerHTML = `<div class="chat-composer-notice">
      <span>Sohbete katılmak için giriş yapmalısın.</span>
      <button class="btn gold" type="button" onclick="openAuth&&openAuth()">Giriş yap</button></div>`;
    return;
  }
  if(chatState.muted){
    const until = chatState.muted.until ? new Date(chatState.muted.until).toLocaleString('tr-TR') : null;
    composer.innerHTML = `<div class="chat-composer-notice is-muted">
      <span>Sohbette yazma yetkin kapatıldı.${until?` Bitiş: ${chatEscape(until)}`:''}${chatState.muted.reason?` · ${chatEscape(chatState.muted.reason)}`:''}</span></div>`;
    return;
  }
  if(room?.is_locked && !chatState.isModerator){
    composer.innerHTML = `<div class="chat-composer-notice">Bu oda şu anda yalnızca moderatörlere açık.</div>`;
    return;
  }
  if(room?.min_account_state === 'verified' && user.emailVerified === false && !chatState.isModerator){
    composer.innerHTML = `<div class="chat-composer-notice">Bu odada yazabilmek için e-posta adresini doğrulaman gerekiyor.</div>`;
    return;
  }

  composer.innerHTML = `
    <form class="chat-composer-form" id="chatComposerForm" autocomplete="off">
      <label class="sr-only" for="chatInput">Mesajın</label>
      <textarea id="chatInput" rows="1" maxlength="${CHAT_BODY_LIMIT}" placeholder="Gündem hakkında ne düşünüyorsun?"></textarea>
      <div class="chat-composer-side">
        <span class="chat-char-count" id="chatCharCount">0/${CHAT_BODY_LIMIT}</span>
        <button class="btn gold chat-send" type="submit" id="chatSendBtn">Gönder</button>
      </div>
    </form>
    <div class="chat-composer-error" id="chatComposerError" role="alert" hidden></div>`;
}

function renderChatHeader(){
  const title = document.getElementById('chatPanelTitle');
  const topic = document.getElementById('chatPanelTopic');
  const room = chatActiveRoom();
  if(title) title.textContent = room?.title || 'Gündem Sohbeti';
  if(topic) topic.textContent = room?.topic || 'Doğrulanmış üyelerin gündem sohbeti';
}

function renderChatPanel(){
  renderChatHeader();
  renderChatRooms();
  renderChatMessages();
  renderChatComposer();
}

/* ---------- akış kontrolü ---------- */

async function chatOpenRoom(roomId){
  if(!roomId || roomId === chatState.activeRoomId && chatState.messages.length) return;
  chatState.activeRoomId = roomId;
  chatState.loading = true;
  chatState.error = null;
  renderChatPanel();
  try{
    await chatLoadMessages(roomId);
    chatState.loading = false;
    chatState.pendingScroll = true;
    chatSubscribe(roomId);
  }catch(error){
    chatState.loading = false;
    chatState.error = error?.message || 'Mesajlar alınamadı.';
  }
  renderChatPanel();
}

async function chatInit(){
  const authContextReady=typeof AUTH_CONTEXT_READY!=='undefined'&&AUTH_CONTEXT_READY;
  if(chatState.ready || !SUPABASE_READY || !authContextReady) {
    if(!SUPABASE_READY || !authContextReady) renderChatPanel();
    return;
  }
  chatState.authUserId=getCurrentUser()?.id||null;
  chatState.loading = true;
  renderChatPanel();
  try{
    await chatLoadRooms();
    await Promise.all([chatCheckMute(), chatDetectModerator()]);
    chatState.ready = true;
    // Aktif lige karşılık gelen odayı varsayılan seç.
    const preferred = (typeof activeFootballLeague === 'string' && chatRoomForLeague(activeFootballLeague)) || chatState.rooms[0];
    chatState.loading = false;
    if(preferred) await chatOpenRoom(preferred.id);
    else renderChatPanel();
  }catch(error){
    chatState.loading = false;
    chatState.error = error?.message || 'Sohbet odaları yüklenemedi.';
    renderChatPanel();
  }
}

function chatToggle(force){
  const panel = document.getElementById('chatPanel');
  if(!panel) return;
  const next = typeof force === 'boolean' ? force : !chatState.open;
  chatState.open = next;
  panel.classList.toggle('open', next);
  panel.setAttribute('aria-hidden', String(!next));
  document.body.classList.toggle('chat-open', next);
  if(next){
    chatState.unread = 0;
    renderChatLauncher();
    chatInit().then(() => {
      const input = document.getElementById('chatInput');
      if(input && window.matchMedia('(min-width: 768px)').matches) input.focus();
    });
  }else{
    renderChatLauncher();
  }
}

/* ---------- olay bağlama ---------- */

function chatShowComposerError(message){
  const box = document.getElementById('chatComposerError');
  if(!box) return;
  box.textContent = message;
  box.hidden = !message;
}

function bindChatEvents(){
  const launcher = document.getElementById('chatLauncher');
  if(launcher) launcher.addEventListener('click', async () => {
    if(typeof ensureXYZSupabaseClient==='function') ensureXYZSupabaseClient().catch(()=>{});
    if(typeof ensureXYZLegacyStyles==='function') await ensureXYZLegacyStyles();
    chatToggle();
  });

  window.addEventListener('xyz:supabase-ready',()=>{
    if(chatState.open) renderChatPanel();
  });
  window.addEventListener('xyz:auth-context-ready',event=>{
    const nextUserId=event?.detail?.userId||null;
    if(chatState.ready&&chatState.authUserId===nextUserId){
      if(chatState.open) renderChatPanel();
      return;
    }
    chatUnsubscribe();
    chatState.ready=false;
    chatState.loading=false;
    chatState.authUserId=nextUserId;
    chatState.muted=null;
    chatState.isModerator=false;
    if(chatState.open) chatInit(); else renderChatPanel();
  });

  const closeBtn = document.getElementById('chatCloseBtn');
  if(closeBtn) closeBtn.addEventListener('click', () => chatToggle(false));

  const panel = document.getElementById('chatPanel');
  if(!panel) return;

  // Oda seçimi, mesaj aksiyonları ve tekrar dene: tek delege dinleyici.
  panel.addEventListener('click', async (event) => {
    const roomBtn = event.target.closest('[data-chat-room]');
    if(roomBtn){ await chatOpenRoom(roomBtn.dataset.chatRoom); return; }

    const retry = event.target.closest('#chatRetryBtn');
    if(retry){ chatState.ready = false; chatState.error = null; await chatInit(); return; }

    const reportBtn = event.target.closest('[data-chat-report]');
    if(reportBtn){
      reportBtn.disabled = true;
      const result = await chatReportMessage(reportBtn.dataset.chatReport);
      reportBtn.textContent = result.ok ? '✓' : '⚑';
      reportBtn.title = result.ok ? 'Bildirildi' : (result.error || 'Bildirilemedi');
      return;
    }
    const deleteBtn = event.target.closest('[data-chat-delete]');
    if(deleteBtn){
      const result = await chatModerate(deleteBtn.dataset.chatDelete, 'delete');
      if(!result.ok) chatShowComposerError(result.error);
      return;
    }
    const restoreBtn = event.target.closest('[data-chat-restore]');
    if(restoreBtn){
      const result = await chatModerate(restoreBtn.dataset.chatRestore, 'restore');
      if(!result.ok) chatShowComposerError(result.error);
      return;
    }
  });

  // Gönderme + otomatik yükseklik + karakter sayacı
  panel.addEventListener('submit', async (event) => {
    if(event.target.id !== 'chatComposerForm') return;
    event.preventDefault();
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');
    if(!input) return;
    const text = input.value;
    if(!text.trim()) return;
    if(sendBtn) sendBtn.disabled = true;
    chatShowComposerError('');
    const result = await chatSendMessage(text);
    if(sendBtn) sendBtn.disabled = false;
    if(result.ok){
      input.value = '';
      input.style.height = 'auto';
      const counter = document.getElementById('chatCharCount');
      if(counter) counter.textContent = `0/${CHAT_BODY_LIMIT}`;
      input.focus();
    }else{
      chatShowComposerError(result.error);
    }
  });

  panel.addEventListener('input', (event) => {
    if(event.target.id !== 'chatInput') return;
    const input = event.target;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    const counter = document.getElementById('chatCharCount');
    if(counter) counter.textContent = `${input.value.length}/${CHAT_BODY_LIMIT}`;
  });

  // Enter gönderir, Shift+Enter satır atlar.
  panel.addEventListener('keydown', (event) => {
    if(event.target.id !== 'chatInput') return;
    if(event.key === 'Enter' && !event.shiftKey){
      event.preventDefault();
      document.getElementById('chatComposerForm')?.requestSubmit();
    }
  });

  // Esc paneli kapatır.
  document.addEventListener('keydown', (event) => {
    if(event.key === 'Escape' && chatState.open) chatToggle(false);
  });

  renderChatLauncher();
}

/* Lig değiştiğinde ilgili odaya geç (panel açıksa). */
function chatSyncWithLeague(leagueKey){
  if(!chatState.ready || !chatState.open) return;
  const room = chatRoomForLeague(leagueKey);
  if(room && room.id !== chatState.activeRoomId) chatOpenRoom(room.id);
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindChatEvents);
else bindChatEvents();
