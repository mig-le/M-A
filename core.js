/* core.js
 - Navegação centralizada com prefetch + History API
 - Injeção de <main data-page="..."> para transições sem full reload
 - Fallback para location.href se o fetch falhar
*/

const pages = [
  '/index.html',
  '/pages/contador.html',
  '/pages/timeline.html',
  '/pages/galeria.html',
  '/pages/cartinhas.html',
  '/pages/jogos.html',
  '/pages/musica.html',
  '/pages/promessas.html',
  '/pages/cartas-futuro.html',
  '/pages/mapa.html',
  '/pages/capsula.html',
  '/pages/contrato.html',
  '/pages/audios.html',
  '/pages/mural.html',
  '/pages/easter-eggs.html',
  '/pages/final.html'
];

const pageCache = new Map();
let currentPath = location.pathname || '/index.html';
let navigationLock = false; // evita reentrância

function getCurrentPageIndex(){
  // Normaliza caminhos para evitar erro se houver barra no final
  const path = currentPath.endsWith('/') && currentPath.length > 1 ? currentPath.slice(0, -1) : currentPath;
  const idx = pages.indexOf(path);
  // Se não achar exato, tenta achar contendo a string (fallback)
  if (idx === -1) {
      return pages.findIndex(p => path.includes(p)) || 0;
  }
  return idx;
}

async function fetchPage(path){
  if(pageCache.has(path)) return pageCache.get(path);
  const res = await fetch(path, { cache: 'no-store' });
  if(!res.ok) throw new Error('Fetch falhou: ' + res.status);
  const text = await res.text();
  pageCache.set(path, text);
  return text;
}

function replaceHistory(path){
  try{ history.replaceState({ path }, '', path); }catch(e){ console.warn('replaceHistory fail', e); }
}
function pushHistory(path){
  try{ history.pushState({ path }, '', path); }catch(e){ console.warn('pushHistory fail', e); }
}

/**
 * navigateTo(path, { replace: false })
 */
async function navigateTo(path, { replace = false } = {}){
  if(navigationLock) return;
  
  // Se o caminho não estiver na lista ou for externo, recarrega normal
  if(!pages.includes(path) && !pages.some(p => path.endsWith(p))){ 
      location.href = path; return; 
  }
  
  if(path === currentPath) return;

  navigationLock = true;
  const container = document.getElementById('app') || document.body; // Fallback para body se não tiver #app
  const currentMain = container.querySelector('main[data-page]') || container.querySelector('main');

  if(currentMain){
    currentMain.classList.add('fade-exit');
  }

  try{
    const html = await fetchPage(path);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newMain = doc.querySelector('main[data-page]') || doc.querySelector('main');
    
    if(!newMain) { location.href = path; return; }

    // Aguarda animação de saída
    setTimeout(()=>{
      try{
        if(currentMain) currentMain.remove();
        
        // Adota o novo nó
        const imported = document.importNode(newMain, true);
        
        // Insere no lugar certo (se tiver header/footer fixos, insere entre eles, senão no fim)
        const glow = document.getElementById('glow');
        if(glow && container === document.body) {
             container.insertBefore(imported, glow.nextSibling); // Tenta inserir depois do glow
        } else {
             container.appendChild(imported);
        }
        
        imported.classList.add('fade-enter');

        // Atualiza estado
        currentPath = path;
        if(replace) replaceHistory(path); else pushHistory(path);

        // Acessibilidade: foca no título
        const focusTarget = imported.querySelector('h1,h2') || imported;
        focusTarget.tabIndex = -1;
        focusTarget.focus();

        // Reinicializa scripts específicos se necessário
        // (Nota: Scripts dentro do novo HTML não rodam automaticamente com innerHTML/append)
        prefetchNeighbors();
        
      }finally{
        navigationLock = false;
      }
    }, 180); // Tempo da transição CSS
  }catch(err){
    console.warn('navigateTo error -> fallback href', err);
    navigationLock = false;
    location.href = path;
  }
}

function goNext(){ 
    const i = getCurrentPageIndex(); 
    if (i < pages.length - 1) {
        navigateTo(pages[i+1]); 
    }
}

function goPrev(){ 
    const i = getCurrentPageIndex(); 
    if (i > 0) {
        navigateTo(pages[i-1]); 
    }
}

// History API
window.addEventListener('popstate', (e)=>{
  const p = (e.state && e.state.path) || location.pathname;
  navigateTo(p, { replace: true }).catch(()=>{ /* silent */ });
});

// --- SWIPE (Otimizado: Roda uma vez só) ---
function initGlobalSwipe(){
  let startX = 0, startY = 0, moved = false;
  
  window.addEventListener('touchstart', e=>{ 
      startX = e.touches[0].clientX; 
      startY = e.touches[0].clientY; 
      moved = false; 
  }, { passive: true });
  
  window.addEventListener('touchmove', e=>{ moved = true; }, { passive: true });
  
  window.addEventListener('touchend', e=>{
    if(!moved) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    
    // Verifica se foi um movimento horizontal significativo
    if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60){
      if(dx < 0) goNext(); // Deslizar para esquerda = Próximo
      else goPrev();       // Deslizar para direita = Voltar
    }
  }, { passive: true });
}

// prefetch das páginas vizinhas
function prefetchNeighbors(){
  const i = getCurrentPageIndex();
  if(i >= 0){
    if(pages[i+1]) fetchPage(pages[i+1]).catch(()=>{});
    if(pages[i-1]) fetchPage(pages[i-1]).catch(()=>{});
  }
}

// Helpers de Storage
function saveProgress(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function loadProgress(key){ try{ return JSON.parse(localStorage.getItem(key)); }catch{ return null; } }


// --- INICIALIZAÇÃO GERAL ---
// Executa apenas UMA vez quando o site carrega
window.addEventListener('load', ()=>{
  currentPath = location.pathname;
  initGlobalSwipe(); // Inicia o swipe globalmente
  prefetchNeighbors();
  
  // Inicia música se necessário (verificação extra)
  if(typeof initMusic === 'function') initMusic();
});


// --- EFEITO DE BRILHO DO MOUSE (Corrigido: Seguro e Otimizado) ---
document.addEventListener('DOMContentLoaded', () => {
    const glow = document.getElementById('glow');

    // Só executa se o elemento "glow" existir na página atual
    if (glow) {
        document.addEventListener('mousemove', (e) => {
            window.requestAnimationFrame(() => {
                glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
            });
        });

        document.addEventListener('mousedown', () => {
            glow.style.width = '600px';
            glow.style.height = '600px';
            glow.style.background = 'radial-gradient(circle, rgba(255, 111, 163, 0.2) 0%, rgba(255, 111, 163, 0) 70%)';
        });

        document.addEventListener('mouseup', () => {
            glow.style.width = '400px';
            glow.style.height = '400px';
            glow.style.background = 'radial-gradient(circle, rgba(255, 111, 163, 0.12) 0%, rgba(255, 111, 163, 0) 70%)';
        });
    }
});


// --- SISTEMA DE MÚSICA GLOBAL (Corrigido: Seguro) ---
function initMusic() {
    const audio = document.getElementById('main-audio');
    const btn = document.getElementById('music-toggle');

    // Só executa se AMBOS (áudio e botão) existirem na página
    if (audio && btn) {
        const isPlaying = localStorage.getItem('music_playing') === 'true';
        const savedTime = localStorage.getItem('music_time') || 0;

        // Tenta recuperar o tempo, se for válido
        if(!isNaN(parseFloat(savedTime))) {
            audio.currentTime = parseFloat(savedTime);
        }

        if (isPlaying) {
            audio.play().catch(() => {
                // Se o navegador bloquear o autoplay
                btn.innerText = "PLAY";
                localStorage.setItem('music_playing', 'false');
            });
            btn.innerText = "PAUSE";
        } else {
            btn.innerText = "PLAY";
        }

        // Remove event listeners antigos para evitar duplicação (hack rápido)
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            if (audio.paused) {
                audio.play();
                newBtn.innerText = "PAUSE";
                localStorage.setItem('music_playing', 'true');
            } else {
                audio.pause();
                newBtn.innerText = "PLAY";
                localStorage.setItem('music_playing', 'false');
            }
        });

        // Loop de salvamento de tempo
        // Limpa intervalo anterior se existir para não acumular
        if(window.musicInterval) clearInterval(window.musicInterval);
        
        window.musicInterval = setInterval(() => {
            if (!audio.paused) {
                localStorage.setItem('music_time', audio.currentTime);
            }
        }, 1000);
    }
}



// No seu core.js
function navigateTo(path) {
    // Esse comando força o navegador a ir para a nova URL
    // e recarregar a página inteira (Full Refresh)
    window.location.href = path;
}

// Tenta iniciar a música no DOMContentLoaded também
document.addEventListener('DOMContentLoaded', initMusic);

// EXPORTS GLOBAIS
window.goNext = goNext;
window.goPrev = goPrev;
window.navigateTo = navigateTo;
window.getCurrentPageIndex = getCurrentPageIndex;
window.prefetch = fetchPage;
window.saveProgress = saveProgress;
window.loadProgress = loadProgress;