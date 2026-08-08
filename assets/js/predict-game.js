(() => {
  const TARGET_GOALS = 10;
  const MAX_MISSES = 5;
  const POINTS_PER_GOAL = 5;
  const MAX_REWARD_POINTS = 50;
  const STORAGE_KEY = 'xyzskor_predict_guest_session_v1';
  const ASSETS = {
    field:'/assets/game/field.webp',
    player:'/assets/game/player-sprite.webp',
    ball:'/assets/game/ball.webp'
  };
  const STATES = Object.freeze({
    INTRO:'INTRO',
    READY:'READY',
    BALL_FALLING:'BALL_FALLING',
    PLAYER_READY:'PLAYER_READY',
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
          <div class="predict-game-points" id="miniGoalPoints">Predict Puanı: 0</div>
          <div class="predict-game-goal" aria-hidden="true"></div>
          <div class="predict-game-ball" id="predictGameBall" aria-hidden="true"></div>
          <div class="predict-game-player" id="predictGamePlayer" aria-hidden="true"></div>
          <div class="predict-game-drag-hint" id="predictGameHint">← Sürükle →</div>
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
    let contactApplied = false;
    const game = {
      state:STATES.INTRO,
      open:false,
      goals:0,
      misses:0,
      rewardEligible:false,
      rewardClaimed:false,
      training:false,
      idempotencyKey:uuid(),
      player:{ x:.5, vx:0, target:.5, state:'idle', frame:0, frameTime:0 },
      ball:{ x:.5, y:.42, vx:0, vy:.34, scale:1, visible:true },
      message:'',
      nextAt:0,
      started:false
    };

    function setState(state, delay = 0){
      game.state = state;
      game.nextAt = delay ? performance.now() + delay : 0;
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

    function renderSprite(dt){
      const ranges = {
        idle:[0, 1],
        ready:[2, 3],
        kick:[4, 9],
        miss:[10, 11],
        celebrate:[12, 15]
      };
      const range = ranges[game.player.state] || ranges.idle;
      game.player.frameTime += dt;
      const speed = game.player.state === 'kick' ? 58 : 150;
      if(game.player.frameTime >= speed){
        game.player.frameTime = 0;
        game.player.frame += 1;
        if(game.player.frame > range[1]) game.player.frame = range[0];
      }
      const frame = clamp(game.player.frame, range[0], range[1]);
      const col = frame % 4;
      const row = Math.floor(frame / 4);
      el.player.style.backgroundPosition = `${col * -100}% ${row * -100}%`;
    }

    function layout(){
      const w = el.field.clientWidth || 360;
      const h = el.field.clientHeight || 640;
      const px = game.player.x * w;
      const bx = game.ball.x * w;
      const by = game.ball.y * h;
      el.player.style.transform = `translate3d(${Math.round(px)}px,0,0)`;
      el.ball.style.transform = `translate3d(${Math.round(bx)}px,${Math.round(by)}px,0) scale(${game.ball.scale})`;
      el.ball.classList.toggle('is-hidden', !game.ball.visible);
    }

    function resetBall(){
      game.ball.x = .18 + Math.random() * .64;
      game.ball.y = .30;
      game.ball.vx = (Math.random() - .5) * .06;
      game.ball.vy = .25 + Math.random() * .08;
      game.ball.scale = .74;
      game.ball.visible = true;
      contactApplied = false;
      game.player.state = 'idle';
      game.player.frame = 0;
      el.toast.textContent = '';
      setState(STATES.BALL_FALLING);
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
        game.rewardClaimed = Boolean(payload.reward?.claimed);
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
      game.player.state = 'celebrate';
      game.player.frame = 12;
      el.toast.textContent = 'GOOOL! +5 Predict Puanı';
      track('predict_game_goal');
      if(game.goals >= TARGET_GOALS){
        setState(STATES.GAME_SUCCESS);
        track('predict_game_success');
        track('predict_game_complete', { final_state:STATES.GAME_SUCCESS });
        finishGame(STATES.GAME_SUCCESS);
      }else{
        setState(STATES.ROUND_RESET, 780);
      }
    }

    function registerMiss(){
      game.misses += 1;
      game.player.state = 'miss';
      game.player.frame = 10;
      el.toast.textContent = 'Kaçtı!';
      track('predict_game_miss');
      if(game.misses >= MAX_MISSES){
        setState(STATES.GAME_OVER);
        track('predict_game_game_over');
        track('predict_game_complete', { final_state:STATES.GAME_OVER });
        finishGame(STATES.GAME_OVER);
      }else{
        setState(STATES.ROUND_RESET, 720);
      }
    }

    function update(dt, now){
      if(!game.open || document.visibilityState === 'hidden') return;
      const step = Math.min(32, dt) / 1000;
      const speed = .95;
      game.player.x += (game.player.target - game.player.x) * Math.min(1, step * 11);
      game.player.x = clamp(game.player.x + game.player.vx * step * speed, .18, .82);
      game.player.vx *= .86;

      if(game.state === STATES.BALL_FALLING || game.state === STATES.PLAYER_READY){
        game.ball.y += game.ball.vy * step;
        game.ball.x += game.ball.vx * step;
        game.ball.scale = clamp(game.ball.scale + step * .16, .74, 1.08);
        const closeY = game.ball.y > .62 && game.ball.y < .78;
        const offset = Math.abs(game.ball.x - game.player.x);
        if(closeY) game.player.state = 'ready';
        if(closeY && offset < .18){
          setState(STATES.KICKING);
          game.player.state = 'kick';
          game.player.frame = 4;
          game.player.frameTime = 0;
        }else if(game.ball.y > .86){
          registerMiss();
        }
      }

      if(game.state === STATES.KICKING){
        if(game.player.frame >= 8 && !contactApplied){
          contactApplied = true;
          const offset = clamp((game.ball.x - game.player.x) / .18, -1, 1);
          game.ball.vx = -offset * .68;
          game.ball.vy = -1.02;
          setState(STATES.BALL_SHOT);
        }
      }

      if(game.state === STATES.BALL_SHOT){
        game.ball.y += game.ball.vy * step;
        game.ball.x += game.ball.vx * step;
        game.ball.vy += 1.08 * step;
        game.ball.scale = clamp(game.ball.scale - step * .24, .58, 1.1);
        if(game.ball.y <= .22){
          if(game.ball.x > .28 && game.ball.x < .72) registerGoal();
          else registerMiss();
        }
        if(game.ball.x < .04 || game.ball.x > .96 || game.ball.y > .94) registerMiss();
      }

      if(game.state === STATES.ROUND_RESET && game.nextAt && now >= game.nextAt) resetBall();
      renderSprite(dt);
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
      game.started = true;
      game.player.x = .5;
      game.player.target = .5;
      el.end.hidden = true;
      el.hint.classList.remove('is-hidden');
      renderHud();
      await startSession();
      setState(STATES.READY);
      resetBall();
      last = performance.now();
      raf = requestAnimationFrame(loop);
      track('predict_game_start', { reward_eligible:game.rewardEligible });
    }

    async function open(){
      game.open = true;
      overlay.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('mini-goal-open');
      el.stage.focus({ preventScroll:true });
      track('predict_game_view');
      await restart();
    }

    function close(){
      game.open = false;
      overlay.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('mini-goal-open');
      if(raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function pointerToPlayer(event){
      const rect = el.field.getBoundingClientRect();
      const clientX = event.touches?.[0]?.clientX ?? event.clientX;
      game.player.target = clamp((clientX - rect.left) / rect.width, .18, .82);
      el.hint.classList.add('is-hidden');
    }

    el.stage.addEventListener('pointerdown', (event) => {
      pointerActive = true;
      el.stage.setPointerCapture?.(event.pointerId);
      pointerToPlayer(event);
      event.preventDefault();
    });
    el.stage.addEventListener('pointermove', (event) => { if(pointerActive) pointerToPlayer(event); });
    el.stage.addEventListener('pointerup', () => { pointerActive = false; });
    el.stage.addEventListener('pointercancel', () => { pointerActive = false; });
    window.addEventListener('keydown', (event) => {
      if(!game.open) return;
      if(event.code === 'ArrowLeft' || event.code === 'KeyA'){ game.player.vx = -.72; el.hint.classList.add('is-hidden'); event.preventDefault(); }
      if(event.code === 'ArrowRight' || event.code === 'KeyD'){ game.player.vx = .72; el.hint.classList.add('is-hidden'); event.preventDefault(); }
      if(event.code === 'Escape') close();
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
