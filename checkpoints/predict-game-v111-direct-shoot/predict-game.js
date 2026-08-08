(() => {
  const TARGET_GOALS = 10;
  const MAX_MISSES = 5;
  const POINTS_PER_GOAL = 5;
  const MAX_REWARD_POINTS = 50;
  const STORAGE_KEY = 'xyzskor_predict_guest_session_v1';
  const ASSETS = {
    field:'/assets/game/field.webp',
    player:'/assets/game/player.webp',
    ball:'/assets/game/ball.webp'
  };
  const STATES = Object.freeze({
    INTRO:'INTRO',
    AIMING:'AIMING',
    KICKING:'KICKING',
    BALL_SHOT:'BALL_SHOT',
    GOAL:'GOAL',
    MISS:'MISS',
    ROUND_RESET:'ROUND_RESET',
    GAME_SUCCESS:'GAME_SUCCESS',
    GAME_OVER:'GAME_OVER',
    REWARD_PENDING:'REWARD_PENDING',
    REWARD_CLAIMED:'REWARD_CLAIMED'
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const pointValue = (goals) => Math.min(goals * POINTS_PER_GOAL, MAX_REWARD_POINTS);
  const uuid = () => crypto?.randomUUID ? crypto.randomUUID() : `pg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const currentUserSafe = () => {
    try{ return typeof getCurrentUser === 'function' ? getCurrentUser() : null; }
    catch(_error){ return null; }
  };

  function guestSessionId(){
    try{
      let id = localStorage.getItem(STORAGE_KEY);
      if(!id){ id = uuid(); localStorage.setItem(STORAGE_KEY, id); }
      return id;
    }catch(_error){ return uuid(); }
  }

  async function authHeaders(){
    const headers = { 'Content-Type':'application/json', Accept:'application/json' };
    try{
      if(typeof sb !== 'undefined' && sb?.auth?.getSession){
        const { data } = await sb.auth.getSession();
        if(data?.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
    }catch(_error){}
    return headers;
  }

  async function gameApi(path, body, method = 'POST'){
    const headers = await authHeaders();
    const response = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json().catch(() => ({}));
    if(!response.ok) throw Object.assign(new Error(payload.error || 'api_error'), { payload, status:response.status });
    return payload;
  }

  function buildGameDOM(overlay){
    const modal = overlay.querySelector('.mini-goal-modal');
    if(!modal) return null;
    modal.classList.add('predict-game-modal');
    modal.innerHTML = `
      <button class="predict-game-close" id="miniGoalClose" type="button" aria-label="Mini oyunu kapat">x</button>
      <div class="predict-game-stage" id="predictGameStage" role="application" aria-label="XYZSKOR Predict mini futbol oyunu" tabindex="0">
        <div class="predict-game-field" id="predictGameField">
          <div class="predict-game-hud" aria-live="polite">
            <div class="predict-game-card"><span>Gol</span><strong id="predictGameGoals">0 / 10</strong></div>
            <div class="predict-game-brand">XYZ<span>SKOR</span></div>
            <div class="predict-game-card"><span>Kalan Hak</span><strong id="predictGameMisses">5</strong></div>
          </div>
          <div class="predict-game-goal" aria-hidden="true"></div>
          <div class="predict-game-aim-target" id="predictGameAimTarget" aria-hidden="true"></div>
          <div class="predict-game-aim-line" id="predictGameAimLine" aria-hidden="true"></div>
          <div class="predict-game-ball" id="predictGameBall" aria-hidden="true"></div>
          <div class="predict-game-player" id="predictGamePlayer" aria-hidden="true">
            <div class="predict-game-player-sprite"></div>
          </div>
          <div class="predict-game-drag-hint" id="predictGameHint">Nişan al, bırak</div>
          <div class="predict-game-points" id="miniGoalPoints">Predict Puanı: 0</div>
          <div class="predict-game-toast" id="predictGameToast" aria-live="polite"></div>
          <div class="predict-game-end" id="predictGameEnd" hidden></div>
        </div>
      </div>
      <footer class="predict-game-actions">
        <button id="miniGoalRestart" type="button">Yeniden başlat</button>
        <span id="miniGoalRemainingMisses" class="predict-game-hidden-status">Kalan Hak: 5</span>
      </footer>`;
    return {
      modal,
      stage:modal.querySelector('#predictGameStage'),
      field:modal.querySelector('#predictGameField'),
      ball:modal.querySelector('#predictGameBall'),
      player:modal.querySelector('#predictGamePlayer'),
      aimLine:modal.querySelector('#predictGameAimLine'),
      aimTarget:modal.querySelector('#predictGameAimTarget'),
      goals:modal.querySelector('#predictGameGoals'),
      misses:modal.querySelector('#predictGameMisses'),
      points:modal.querySelector('#miniGoalPoints'),
      statusMisses:modal.querySelector('#miniGoalRemainingMisses'),
      toast:modal.querySelector('#predictGameToast'),
      end:modal.querySelector('#predictGameEnd'),
      hint:modal.querySelector('#predictGameHint'),
      close:modal.querySelector('#miniGoalClose'),
      restart:modal.querySelector('#miniGoalRestart')
    };
  }

  window.initPredictMiniGame = function initPredictMiniGame({ trigger, overlay } = {}){
    if(!trigger || !overlay || trigger.dataset.predictReady) return null;
    const el = buildGameDOM(overlay);
    if(!el) return null;
    trigger.dataset.predictReady = '1';
    let raf = 0;
    let last = 0;
    let pointerActive = false;
    let session = null;
    let outcomeSent = false;
    let kickStartedAt = 0;
    const game = {
      state:STATES.INTRO,
      open:false,
      goals:0,
      misses:0,
      rewardEligible:false,
      training:false,
      idempotencyKey:uuid(),
      player:{ x:.5 },
      aim:{ x:.5, active:false },
      ball:{ x:.5, y:.665, vx:0, vy:0, scale:1, rot:0, visible:true },
      nextAt:0
    };

    function setState(state, delay = 0){
      game.state = state;
      game.nextAt = delay ? performance.now() + delay : 0;
      el.field.dataset.state = state.toLowerCase();
      el.player.classList.toggle('is-kicking', state === STATES.KICKING);
      el.player.classList.toggle('is-celebrate', state === STATES.GOAL);
      el.player.classList.toggle('is-miss', state === STATES.MISS);
      el.ball.classList.toggle('is-shot', state === STATES.BALL_SHOT);
    }

    function track(name, data = {}){
      if(typeof trackEvent === 'function') trackEvent(name, { goals:game.goals, misses:game.misses, points:pointValue(game.goals), ...data });
    }

    function renderHud(){
      const points = pointValue(game.goals);
      el.goals.textContent = `${game.goals} / ${TARGET_GOALS}`;
      el.misses.textContent = String(Math.max(0, MAX_MISSES - game.misses));
      el.points.textContent = `Predict Puanı: ${points}`;
      el.statusMisses.textContent = `Kalan Hak: ${Math.max(0, MAX_MISSES - game.misses)}`;
    }

    function layout(){
      const w = el.field.clientWidth || 360;
      const h = el.field.clientHeight || 640;
      const px = game.player.x * w;
      const bx = game.ball.x * w;
      const by = game.ball.y * h;
      const targetX = game.aim.x * w;
      const targetY = h * .19;
      const dx = targetX - bx;
      const dy = targetY - by;
      const length = Math.max(90, Math.hypot(dx, dy));
      const angle = Math.atan2(dx, -dy) * 180 / Math.PI;
      el.player.style.setProperty('--pg-x', `${Math.round(px)}px`);
      el.ball.style.setProperty('--ball-x', `${Math.round(bx)}px`);
      el.ball.style.setProperty('--ball-y', `${Math.round(by)}px`);
      el.ball.style.setProperty('--ball-scale', game.ball.scale.toFixed(3));
      el.ball.style.setProperty('--ball-rot', `${Math.round(game.ball.rot)}deg`);
      el.ball.classList.toggle('is-hidden', !game.ball.visible);
      el.aimLine.style.setProperty('--aim-left', `${Math.round(bx)}px`);
      el.aimLine.style.setProperty('--aim-top', `${Math.round(by)}px`);
      el.aimLine.style.setProperty('--aim-height', `${Math.round(length)}px`);
      el.aimLine.style.setProperty('--aim-angle', `${angle.toFixed(2)}deg`);
      el.aimTarget.style.setProperty('--target-x', `${Math.round(targetX)}px`);
      el.aimTarget.style.opacity = game.state === STATES.AIMING ? '1' : '0';
      el.aimLine.style.opacity = game.state === STATES.AIMING ? '1' : '0';
    }

    function resetRound(){
      game.player.x = .5;
      game.aim.x = .5;
      game.ball.x = .5;
      game.ball.y = .665;
      game.ball.vx = 0;
      game.ball.vy = 0;
      game.ball.scale = 1;
      game.ball.rot = 0;
      game.ball.visible = true;
      pointerActive = false;
      el.toast.textContent = '';
      setState(STATES.AIMING);
      layout();
    }

    async function startSession(){
      session = { id:null, guestSessionId:guestSessionId() };
      try{
        const payload = await gameApi('/api/predict-game/session', { guestSessionId:session.guestSessionId });
        session = { ...session, ...payload.session };
        game.rewardEligible = Boolean(payload.session?.reward_eligible);
        game.training = payload.session?.reward_eligible === false && Boolean(currentUserSafe()?.id);
        if(game.training) el.toast.textContent = 'Bugünkü ödüllü oyun tamamlandı. Bu tur antrenman.';
      }catch(_error){
        session.id = uuid();
        game.rewardEligible = false;
      }
    }

    async function finishGame(finalState){
      if(outcomeSent) return;
      outcomeSent = true;
      setState(STATES.REWARD_PENDING);
      renderEnd(finalState, 'Puanın kaydediliyor...');
      const body = {
        sessionId:session?.id,
        guestSessionId:session?.guestSessionId || guestSessionId(),
        goals:game.goals,
        misses:game.misses,
        finalState,
        idempotencyKey:game.idempotencyKey
      };
      try{
        const payload = await gameApi('/api/predict-game/complete', body);
        setState(STATES.REWARD_CLAIMED);
        renderEnd(finalState, rewardText(payload));
        if(payload.reward?.claimed) track('predict_game_reward_claimed', { reward_points:payload.reward.points });
        if(payload.reward?.blocked === 'daily_limit') track('predict_game_reward_blocked_daily_limit');
      }catch(_error){
        renderEnd(finalState, currentUserSafe()?.id ? 'Puanın henüz hesabına eklenemedi. Tekrar deneyebilirsin.' : guestText());
      }
    }

    function rewardText(payload){
      const points = payload?.reward?.points ?? pointValue(game.goals);
      if(!currentUserSafe()?.id) return guestText();
      if(payload?.reward?.blocked === 'daily_limit') return 'Bugünkü ödüllü oyununu tamamladın. Bu skor antrenman olarak kaydedildi.';
      if(payload?.reward?.claimed) return `${points} Predict Puanı hesabına eklendi.`;
      return `${points} Predict Puanı topladın.`;
    }

    function guestText(){
      return `Bravo! ${pointValue(game.goals)} Predict Puanı topladın. Bu puanları kullanmak veya hesabına eklemek için giriş yap veya kayıt ol.`;
    }

    function renderEnd(finalState, text){
      const success = finalState === STATES.GAME_SUCCESS;
      el.end.hidden = false;
      el.end.innerHTML = `
        <div class="predict-game-end-card">
          <span>${success ? 'Bravo' : 'Oyun Bitti'}</span>
          <strong>${game.goals} / ${TARGET_GOALS}</strong>
          <p>${text}</p>
          <div class="predict-game-end-actions">
            ${!currentUserSafe()?.id ? '<button type="button" data-pg-auth="login">Giriş Yap</button><button type="button" data-pg-auth="register">Kayıt Ol</button>' : ''}
            <button type="button" data-pg-restart>Tekrar oyna</button>
          </div>
        </div>`;
    }

    function registerGoal(){
      game.goals += 1;
      setState(STATES.GOAL);
      el.toast.textContent = 'GOOOL! +5 Predict Puanı';
      track('predict_game_goal');
      if(game.goals >= TARGET_GOALS){
        setState(STATES.GAME_SUCCESS);
        track('predict_game_success');
        track('predict_game_complete', { final_state:STATES.GAME_SUCCESS });
        finishGame(STATES.GAME_SUCCESS);
      }else{
        setState(STATES.ROUND_RESET, 820);
      }
    }

    function registerMiss(){
      game.misses += 1;
      setState(STATES.MISS);
      el.toast.textContent = 'Kaçtı!';
      track('predict_game_miss');
      if(game.misses >= MAX_MISSES){
        setState(STATES.GAME_OVER);
        track('predict_game_game_over');
        track('predict_game_complete', { final_state:STATES.GAME_OVER });
        finishGame(STATES.GAME_OVER);
      }else{
        setState(STATES.ROUND_RESET, 760);
      }
    }

    function aimFromPointer(event){
      const rect = el.field.getBoundingClientRect();
      const clientX = event.touches?.[0]?.clientX ?? event.clientX;
      game.aim.x = clamp((clientX - rect.left) / rect.width, .18, .82);
      el.hint.classList.add('is-hidden');
      layout();
    }

    function shoot(now){
      if(game.state !== STATES.AIMING) return;
      const dx = game.aim.x - game.ball.x;
      game.ball.vx = dx * 1.55;
      game.ball.vy = -1.22;
      game.ball.scale = 1.03;
      kickStartedAt = now;
      setState(STATES.KICKING);
    }

    function update(dt, now){
      if(!game.open || document.visibilityState === 'hidden') return;
      const step = Math.min(32, dt) / 1000;

      if(game.state === STATES.KICKING && now - kickStartedAt > 130) setState(STATES.BALL_SHOT);

      if(game.state === STATES.BALL_SHOT){
        game.ball.y += game.ball.vy * step;
        game.ball.x += game.ball.vx * step;
        game.ball.vy += .62 * step;
        game.ball.rot += 720 * step;
        game.ball.scale = clamp(game.ball.scale - step * .22, .64, 1.08);
        if(game.ball.y <= .205){
          if(game.ball.x > .265 && game.ball.x < .735) registerGoal();
          else registerMiss();
        }
        if(game.ball.x < .02 || game.ball.x > .98 || game.ball.y > .94) registerMiss();
      }

      if(game.state === STATES.ROUND_RESET && game.nextAt && now >= game.nextAt) resetRound();
      renderHud();
      layout();
    }

    function loop(now){
      if(!game.open) return;
      update(now - last, now);
      last = now;
      raf = requestAnimationFrame(loop);
    }

    async function restart(){
      cancelAnimationFrame(raf);
      raf = 0;
      outcomeSent = false;
      session = null;
      game.goals = 0;
      game.misses = 0;
      game.idempotencyKey = uuid();
      el.end.hidden = true;
      el.hint.classList.remove('is-hidden');
      renderHud();
      await startSession();
      resetRound();
      last = performance.now();
      raf = requestAnimationFrame(loop);
      track('predict_game_start', { reward_eligible:game.rewardEligible });
    }

    async function open(){
      game.open = true;
      overlay.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('mini-goal-open');
      trigger.classList.add('is-game-hidden');
      el.stage.focus({ preventScroll:true });
      track('predict_game_view');
      await restart();
    }

    function close(){
      game.open = false;
      overlay.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('mini-goal-open');
      trigger.classList.remove('is-game-hidden');
      if(raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    el.stage.addEventListener('pointerdown', (event) => {
      if(game.state !== STATES.AIMING) return;
      pointerActive = true;
      el.stage.setPointerCapture?.(event.pointerId);
      aimFromPointer(event);
      event.preventDefault();
    });
    el.stage.addEventListener('pointermove', (event) => {
      if(pointerActive && game.state === STATES.AIMING) aimFromPointer(event);
    });
    el.stage.addEventListener('pointerup', (event) => {
      if(!pointerActive) return;
      pointerActive = false;
      aimFromPointer(event);
      shoot(performance.now());
    });
    el.stage.addEventListener('pointercancel', () => { pointerActive = false; });
    window.addEventListener('keydown', (event) => {
      if(!game.open) return;
      if(game.state === STATES.AIMING && (event.code === 'ArrowLeft' || event.code === 'KeyA')){
        game.aim.x = clamp(game.aim.x - .035, .18, .82);
        el.hint.classList.add('is-hidden');
        event.preventDefault();
      }
      if(game.state === STATES.AIMING && (event.code === 'ArrowRight' || event.code === 'KeyD')){
        game.aim.x = clamp(game.aim.x + .035, .18, .82);
        el.hint.classList.add('is-hidden');
        event.preventDefault();
      }
      if(game.state === STATES.AIMING && (event.code === 'Space' || event.code === 'Enter')){
        el.hint.classList.add('is-hidden');
        shoot(performance.now());
        event.preventDefault();
      }
      if(event.code === 'Escape') close();
      layout();
    });
    document.addEventListener('visibilitychange', () => { last = performance.now(); });
    el.close.addEventListener('click', close);
    el.restart.addEventListener('click', restart);
    el.end.addEventListener('click', (event) => {
      const auth = event.target.closest('[data-pg-auth]');
      const again = event.target.closest('[data-pg-restart]');
      if(auth && typeof openAuth === 'function'){
        track(auth.dataset.pgAuth === 'register' ? 'predict_game_register_click' : 'predict_game_login_click');
        openAuth(auth.dataset.pgAuth);
      }
      if(again) restart();
    });
    [ASSETS.field, ASSETS.player, ASSETS.ball].forEach((src) => { const img = new Image(); img.src = src; });
    renderHud();
    layout();
    return { open, close, restart };
  };
})();
