(() => {
  const TARGET_GOALS = 10;
  const MAX_MISSES = 5;
  const POINTS_PER_GOAL = 5;
  const MAX_REWARD_POINTS = 50;
  const STORAGE_KEY = 'xyzskor_predict_guest_session_v1';
  const FIELD_SRC = '/assets/game/field.webp';
  const BALL_SRC = '/assets/game/ball.webp';
  const STATES = Object.freeze({
    PLAYING:'PLAYING',
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
    modal.classList.remove('predict-game-modal');
    modal.classList.add('mini-goal-legacy-modal');
    modal.innerHTML = `
      <header class="mini-goal-head">
        <div>
          <span>Predict Mini Oyun</span>
          <h2>Golü At</h2>
          <p>Top sekiyor. Alttaki barı sağa-sola sürükle, topu kaleye sektir.</p>
        </div>
        <button class="mini-goal-close" id="miniGoalClose" type="button" aria-label="Mini oyunu kapat">x</button>
      </header>
      <div class="mini-goal-score" aria-live="polite">
        <div class="mini-goal-score-item">Gol <strong id="predictGameGoals">0 / 10</strong></div>
        <div class="mini-goal-score-item" id="miniGoalRemainingMisses">Kalan Hak: 5</div>
      </div>
      <canvas id="miniGoalCanvas" width="420" height="560" aria-label="Yeşil sahada seken top mini oyunu"></canvas>
      <footer class="mini-goal-actions">
        <button id="miniGoalRestart" type="button">Yeniden başlat</button>
        <small id="miniGoalPoints">Predict Puanı: 0</small>
      </footer>
      <div class="mini-goal-end" id="predictGameEnd" hidden></div>`;
    return {
      modal,
      canvas:modal.querySelector('#miniGoalCanvas'),
      close:modal.querySelector('#miniGoalClose'),
      restart:modal.querySelector('#miniGoalRestart'),
      goals:modal.querySelector('#predictGameGoals'),
      misses:modal.querySelector('#miniGoalRemainingMisses'),
      points:modal.querySelector('#miniGoalPoints'),
      end:modal.querySelector('#predictGameEnd')
    };
  }

  window.initPredictMiniGame = function initPredictMiniGame({ trigger, overlay } = {}){
    if(!trigger || !overlay || trigger.dataset.predictReady) return null;
    const el = buildGameDOM(overlay);
    if(!el) return null;
    trigger.dataset.predictReady = '1';

    const ctx = el.canvas.getContext('2d');
    const fieldImage = new Image();
    const ballImage = new Image();
    fieldImage.src = FIELD_SRC;
    ballImage.src = BALL_SRC;

    let raf = 0;
    let last = 0;
    let pointerActive = false;
    let session = null;
    let outcomeSent = false;
    const game = {
      open:false,
      state:STATES.PLAYING,
      goals:0,
      misses:0,
      rewardEligible:false,
      training:false,
      idempotencyKey:uuid(),
      w:420,
      h:560,
      keys:new Set(),
      ball:{ x:210, y:292, vx:3.1, vy:3.6, r:28, spin:0 },
      bar:{ x:148, y:414, w:124, h:18, speed:8.6, vx:0 },
      goal:{ x:104, y:78, w:212, h:72 },
      goalFlashUntil:0
    };

    function track(name, data = {}){
      if(typeof trackEvent === 'function') trackEvent(name, { goals:game.goals, misses:game.misses, points:pointValue(game.goals), ...data });
    }

    function setupCanvas(){
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      el.canvas.width = game.w * ratio;
      el.canvas.height = game.h * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function renderHud(){
      el.goals.textContent = `${game.goals} / ${TARGET_GOALS}`;
      el.points.textContent = `Predict Puanı: ${pointValue(game.goals)}`;
      el.misses.textContent = `Kalan Hak: ${Math.max(0, MAX_MISSES - game.misses)}`;
    }

    function drawField(){
      if(fieldImage.complete && fieldImage.naturalWidth){
        ctx.drawImage(fieldImage, 0, 0, game.w, game.h);
      }else{
        const grd = ctx.createLinearGradient(0, 0, 0, game.h);
        grd.addColorStop(0, '#31b64a');
        grd.addColorStop(1, '#0f6f28');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, game.w, game.h);
      }
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(0, 0, game.w, game.h);
    }

    function drawGoal(now){
      const flash = now < game.goalFlashUntil;
      if(!flash) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,199,43,.98)';
      ctx.lineWidth = 5;
      ctx.shadowColor = 'rgba(255,199,43,.9)';
      ctx.shadowBlur = 22;
      roundRect(game.goal.x, game.goal.y, game.goal.w, game.goal.h, 12);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,199,43,.14)';
      ctx.fillRect(game.goal.x, game.goal.y, game.goal.w, game.goal.h);
      ctx.restore();
    }

    function drawBar(){
      const { x, y, w, h } = game.bar;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.34)';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h + 13, w * .48, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      const grd = ctx.createLinearGradient(x, y, x + w, y);
      grd.addColorStop(0, '#ffb000');
      grd.addColorStop(.5, '#fff5b3');
      grd.addColorStop(1, '#ff8a00');
      ctx.fillStyle = grd;
      roundRect(x, y, w, h, 999);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.62)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    function drawBall(){
      const { x, y, r, spin } = game.ball;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin);
      if(ballImage.complete && ballImage.naturalWidth){
        ctx.drawImage(ballImage, -r, -r, r * 2, r * 2);
      }else{
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawMessage(){
      if(game.state === STATES.PLAYING) return;
      const success = game.state === STATES.GAME_SUCCESS;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.52)';
      ctx.fillRect(0, 0, game.w, game.h);
      ctx.fillStyle = '#fff';
      ctx.font = '900 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(success ? 'Bravo!' : 'Oyun Bitti', game.w / 2, game.h / 2 - 8);
      ctx.font = '800 16px sans-serif';
      ctx.fillText(`${game.goals}/${TARGET_GOALS} gol - ${pointValue(game.goals)} Predict Puanı`, game.w / 2, game.h / 2 + 26);
      ctx.restore();
    }

    function roundRect(x, y, w, h, r){
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      ctx.closePath();
    }

    function draw(now = performance.now()){
      ctx.clearRect(0, 0, game.w, game.h);
      drawField();
      drawGoal(now);
      drawBar();
      drawBall();
      drawMessage();
    }

    function resetBall(direction = 1){
      game.ball.x = game.w / 2;
      game.ball.y = 292;
      game.ball.vx = (Math.random() > .5 ? 1 : -1) * (2.4 + Math.random() * 1.7);
      game.ball.vy = direction * (3.2 + Math.random() * 1.2);
      game.ball.spin = 0;
    }

    function restartState(){
      outcomeSent = false;
      game.state = STATES.PLAYING;
      game.goals = 0;
      game.misses = 0;
      game.idempotencyKey = uuid();
      game.bar.x = (game.w - game.bar.w) / 2;
      game.bar.vx = 0;
      game.goalFlashUntil = 0;
      el.end.hidden = true;
      resetBall(1);
      renderHud();
      draw();
    }

    async function startSession(){
      session = { id:null, guestSessionId:guestSessionId() };
      try{
        const payload = await gameApi('/api/predict-game/session', { guestSessionId:session.guestSessionId });
        session = { ...session, ...payload.session };
        game.rewardEligible = Boolean(payload.session?.reward_eligible);
        game.training = payload.session?.reward_eligible === false && Boolean(currentUserSafe()?.id);
      }catch(_error){
        session.id = uuid();
        game.rewardEligible = false;
      }
    }

    function registerGoal(){
      if(game.state !== STATES.PLAYING) return;
      game.goals += 1;
      game.goalFlashUntil = performance.now() + 950;
      track('predict_game_goal');
      renderHud();
      if(game.goals >= TARGET_GOALS){
        complete(STATES.GAME_SUCCESS);
      }else{
        resetBall(1);
      }
    }

    function registerMiss(){
      if(game.state !== STATES.PLAYING) return;
      game.misses += 1;
      track('predict_game_miss');
      renderHud();
      if(game.misses >= MAX_MISSES){
        complete(STATES.GAME_OVER);
      }else{
        resetBall(-1);
      }
    }

    function complete(finalState){
      game.state = finalState;
      track(finalState === STATES.GAME_SUCCESS ? 'predict_game_success' : 'predict_game_game_over');
      track('predict_game_complete', { final_state:finalState });
      finishGame(finalState);
    }

    async function finishGame(finalState){
      if(outcomeSent) return;
      outcomeSent = true;
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
        game.state = STATES.REWARD_CLAIMED;
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
        <div class="mini-goal-end-card">
          <span>${success ? 'Bravo' : 'Oyun Bitti'}</span>
          <strong>${game.goals} / ${TARGET_GOALS}</strong>
          <p>${text}</p>
          <div class="mini-goal-end-actions">
            ${!currentUserSafe()?.id ? '<button type="button" data-pg-auth="login">Giriş Yap</button><button type="button" data-pg-auth="register">Kayıt Ol</button>' : ''}
            <button type="button" data-pg-restart>Tekrar oyna</button>
          </div>
        </div>`;
    }

    function step(dt){
      if(game.state !== STATES.PLAYING) return;
      const ball = game.ball;
      const bar = game.bar;
      const speed = Math.min(2.1, Math.max(.7, dt / 16.67));
      if(game.keys.has('ArrowLeft') || game.keys.has('KeyA')) bar.vx = -bar.speed;
      if(game.keys.has('ArrowRight') || game.keys.has('KeyD')) bar.vx = bar.speed;
      bar.x = clamp(bar.x + bar.vx * speed, 18, game.w - bar.w - 18);
      bar.vx *= pointerActive ? .92 : .78;

      ball.x += ball.vx * speed;
      ball.y += ball.vy * speed;
      ball.spin += ball.vx * .025 * speed;

      if(ball.x - ball.r <= 14){
        ball.x = 14 + ball.r;
        ball.vx = Math.abs(ball.vx);
      }
      if(ball.x + ball.r >= game.w - 14){
        ball.x = game.w - 14 - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }
      if(ball.y - ball.r <= 10){
        ball.y = 10 + ball.r;
        ball.vy = Math.abs(ball.vy);
      }

      const hitBar = ball.vy > 0 &&
        ball.y + ball.r >= bar.y &&
        ball.y - ball.r <= bar.y + bar.h &&
        ball.x >= bar.x - ball.r &&
        ball.x <= bar.x + bar.w + ball.r;
      if(hitBar){
        const offset = ((ball.x - (bar.x + bar.w / 2)) / (bar.w / 2));
        ball.y = bar.y - ball.r - 1;
        ball.vy = -(4.3 + Math.min(1.4, Math.abs(offset) * 1.2));
        ball.vx = clamp(ball.vx + offset * 2.2, -6.2, 6.2);
      }

      const inGoal = ball.y - ball.r <= game.goal.y + game.goal.h &&
        ball.y + ball.r >= game.goal.y &&
        ball.x >= game.goal.x &&
        ball.x <= game.goal.x + game.goal.w;
      if(inGoal && ball.vy < 0) registerGoal();
      if(ball.y - ball.r > game.h) registerMiss();
    }

    function loop(now){
      if(!game.open) return;
      step(now - last);
      draw(now);
      last = now;
      raf = requestAnimationFrame(loop);
    }

    async function restart(){
      cancelAnimationFrame(raf);
      raf = 0;
      session = null;
      restartState();
      await startSession();
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

    function moveBarFromPointer(event){
      const rect = el.canvas.getBoundingClientRect();
      const clientX = event.touches?.[0]?.clientX ?? event.clientX;
      const ratio = game.w / rect.width;
      game.bar.x = clamp((clientX - rect.left) * ratio - game.bar.w / 2, 18, game.w - game.bar.w - 18);
    }

    el.canvas.addEventListener('pointerdown', (event) => {
      pointerActive = true;
      el.canvas.setPointerCapture?.(event.pointerId);
      moveBarFromPointer(event);
      event.preventDefault();
    });
    el.canvas.addEventListener('pointermove', (event) => {
      if(pointerActive) moveBarFromPointer(event);
    });
    el.canvas.addEventListener('pointerup', () => { pointerActive = false; });
    el.canvas.addEventListener('pointercancel', () => { pointerActive = false; });
    window.addEventListener('keydown', (event) => {
      if(!game.open) return;
      if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(event.code)){
        game.keys.add(event.code);
        event.preventDefault();
      }
      if(event.code === 'Escape') close();
    });
    window.addEventListener('keyup', (event) => { game.keys.delete(event.code); });
    window.addEventListener('resize', () => { setupCanvas(); draw(); });
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
    fieldImage.addEventListener('load', draw);
    ballImage.addEventListener('load', draw);
    setupCanvas();
    renderHud();
    draw();
    return { open, close, restart };
  };
})();
