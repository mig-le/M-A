// multiplayer.js — exemplo mínimo com Firebase Realtime Database (compat)
// Requisitos: /firebase-config.js com window._firebaseConfig e SDK compat incluído nas páginas.

// Safety: não inicializa Firebase se já estiver inicializado
(function(){
  if(typeof window === 'undefined') return;
  if(typeof firebase === 'undefined') { console.warn('Firebase SDK não encontrado. Adicione o compat CDN na página.'); return; }

  try{
    if(!firebase.apps || firebase.apps.length === 0){
      firebase.initializeApp(window._firebaseConfig || {});
    }
  }catch(e){
    console.warn('Firebase init skip', e);
  }

  const db = firebase.database();

  function makeCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }

  async function createRoom(){
    const code = makeCode();
    const ref = db.ref('nh_rooms/' + code);
    await ref.set({ createdAt: Date.now(), players: { p1: { joinedAt: Date.now() } }, state: { phase: 'waiting' } });
    return code;
  }

  async function joinRoom(code){
    const ref = db.ref('nh_rooms/' + code);
    const snap = await ref.once('value');
    if(!snap.exists()) throw new Error('Sala não existe');
    await ref.child('players/p2').set({ joinedAt: Date.now() });
    return ref;
  }

  // UI bindings (se presentes)
  document.addEventListener('DOMContentLoaded', ()=>{
    const createBtn = document.getElementById('createRoom');
    const joinBtn = document.getElementById('joinRoom');
    const codeInput = document.getElementById('roomCode');
    const area = document.getElementById('multiplayerArea');

    if(createBtn) createBtn.addEventListener('click', async ()=>{
      createBtn.disabled = true;
      try{
        const code = await createRoom();
        area.textContent = 'Sala criada: ' + code;
        localStorage.setItem('nh_room', code);
        // ouvir mudanças
        db.ref('nh_rooms/' + code + '/state').on('value', snap=>{
          area.textContent = 'Sala ' + code + ' | state: ' + JSON.stringify(snap.val());
        });
      }catch(e){ alert('Erro: ' + e.message); }
      finally{ createBtn.disabled = false; }
    });

    if(joinBtn) joinBtn.addEventListener('click', async ()=>{
      joinBtn.disabled = true;
      try{
        const code = (codeInput && codeInput.value || '').trim();
        if(!code) return alert('Digite o código da sala');
        await joinRoom(code);
        area.textContent = 'Entrou na sala ' + code;
      }catch(e){ alert('Erro: ' + e.message); }
      finally{ joinBtn.disabled = false; }
    });
  });

  window.createRoom = createRoom;
  window.joinRoom = joinRoom;
})();

const db = firebase.database();
const mpArea = document.getElementById('multiplayerArea');

createRoom.onclick = () => {
  const code = Math.random().toString(36).substring(2, 7);
  const ref = db.ref('rooms/' + code);
  ref.set({ players: 1 });
  enterRoom(code);
};

joinRoom.onclick = () => {
  const code = roomCode.value.trim();
  if (!code) return;
  enterRoom(code);
};

function enterRoom(code) {
  const ref = db.ref('rooms/' + code);
  ref.once('value', snap => {
    if (!snap.exists()) {
      mpArea.textContent = 'Sala não existe 😢';
      return;
    }
    ref.child('players').transaction(n => (n || 0) + 1);
    listenRoom(code);
    mpArea.innerHTML = `🎉 Sala <b>${code}</b> conectada`;
  });
}

function listenRoom(code) {
  const ref = db.ref('rooms/' + code + '/players');
  ref.on('value', snap => {
    mpArea.innerHTML = `👥 Jogadores conectados: ${snap.val()}`;
  });
}
