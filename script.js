import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://nfgrqqrehsaoizxwqcbx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_12m7lAGb9I4FnC-pveVNCw_ymG6DneT';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioAtual = null;
let coordenadorLogado = false;
let trabalhadorAtual = null;
let grafConsumo = null, grafValor = null;
let contaParada = false;
let abaTrabAtual = 'inicio';
let suporteSelecionadoId = null;
let tecnicoEscolhidoEmail = null;
let ultimoTotalEnviados = 0;
let nivelSensorSimulado = 30;

function mostrarToast(texto, tipo='ok') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = texto;
  t.className = 'toast ' + tipo;
  setTimeout(() => t.className = 'toast ' + tipo + ' show', 10);
  setTimeout(() => { t.className = 'toast ' + tipo; }, 4500);
}

function mostrarAlertaGrande(titulo, msg) {
  const a = document.getElementById('alertaVazamento');
  document.getElementById('alertaTitulo').textContent = titulo;
  document.getElementById('alertaMsg').textContent = msg;
  a.classList.remove('hidden');
}

window.fecharAlertaGrande = function() {
  document.getElementById('alertaVazamento').classList.add('hidden');
};

function corSensor(cm) {
  if (cm <= 49) return 'verde';
  if (cm <= 150) return 'amarelo';
  return 'vermelho';
}
function textoStatusSensor(cor) {
  if (cor === 'verde') return { status: 'BOM', frase: 'Está tudo bem.', icone: '●' };
  if (cor === 'amarelo') return { status: 'ATENÇÃO', frase: 'Fique de olho.', icone: '●' };
  return { status: 'CRÍTICO', frase: 'Avise o técnico.', icone: '●' };
}

window.sair = async function() { await supabase.auth.signOut(); location.href = 'index.html'; };
window.sairCoord = function() { coordenadorLogado = false; location.href = 'index.html'; };
window.sairTrabalhador = function() { trabalhadorAtual = null; location.href = 'index.html'; };

function mostrarMsg(id, texto, tipo='ok') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className = 'msg ' + tipo;
  setTimeout(() => el.className = 'msg', 4500);
}

function mesAtualStr() {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

window.mostrarForm = function(qual) {
  document.getElementById('telaBotoes').classList.add('hidden');
  ['formLogin','formCad','formCoord','formTrab'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const mapa = { login: 'formLogin', cad: 'formCad', coord: 'formCoord', trab: 'formTrab' };
  const alvo = document.getElementById(mapa[qual]);
  if (alvo) alvo.classList.remove('hidden');
};
window.voltarInicio = function() {
  ['formLogin','formCad','formCoord','formTrab'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  document.getElementById('telaBotoes').classList.remove('hidden');
};

async function boot() {
  const { data: cfg } = await supabase.from('config').select('*').eq('id', 1).single();
  if (!cfg || !cfg.senha_coordenador) {
    document.getElementById('telaPrimeiroAcesso').classList.remove('hidden');
    document.getElementById('telaAuth').classList.add('hidden');
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (session) mostrarApp(session.user);
}

window.definirSenhaCoordenador = async function() {
  const s1 = document.getElementById('senhaCoord1').value;
  const s2 = document.getElementById('senhaCoord2').value;
  if (!s1 || s1.length < 4) return mostrarMsg('msgPrimeiro', 'Senha 4+ caracteres.', 'err');
  if (s1 !== s2) return mostrarMsg('msgPrimeiro', 'Senhas não coincidem.', 'err');
  const { error } = await supabase.from('config').update({ senha_coordenador: s1 }).eq('id', 1);
  if (error) return mostrarMsg('msgPrimeiro', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgPrimeiro', 'Senha definida.', 'ok');
  setTimeout(() => location.reload(), 1200);
};

window.fazerCadastro = async function() {
  const email = document.getElementById('cadEmail').value.trim();
  const senha = document.getElementById('cadSenha').value;
  const senha2 = document.getElementById('cadSenha2').value;
  const rua = document.getElementById('cadRua').value.trim();
  const endereco = document.getElementById('cadEndereco').value.trim();
  const pessoas = document.getElementById('cadPessoas').value;
  const lavaJato = document.getElementById('cadLavaJato').value;

  if (!email || !senha) return mostrarMsg('msgAuth', 'Preencha e-mail e senha.', 'err');
  if (senha.length < 6) return mostrarMsg('msgAuth', 'Senha 6+ caracteres.', 'err');
  if (senha !== senha2) return mostrarMsg('msgAuth', 'Senhas não coincidem.', 'err');
  if (!rua) return mostrarMsg('msgAuth', 'Informe a rua.', 'err');
  if (!endereco) return mostrarMsg('msgAuth', 'Informe o endereço.', 'err');
  if (!pessoas) return mostrarMsg('msgAuth', 'Informe quantas pessoas moram na casa.', 'err');
  if (!lavaJato) return mostrarMsg('msgAuth', 'Informe se tem lava-jato.', 'err');

  mostrarMsg('msgAuth', 'Criando conta...', 'ok');
  const { error } = await supabase.auth.signUp({ email, password: senha });
  if (error) return mostrarMsg('msgAuth', 'Erro: ' + error.message, 'err');
  const { data: login, error: errLogin } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (errLogin) return mostrarMsg('msgAuth', 'Erro login: ' + errLogin.message, 'err');

  await supabase.from('profiles').upsert({
    id: login.user.id, email: login.user.email,
    consumo_m3: 12.5, valor_conta: 87.30,
    congelado: false, tipo: 'usuario',
    rua, endereco,
    num_pessoas: Number(pessoas),
    lava_jato: lavaJato === 'sim'
  }, { onConflict: 'id' });

  mostrarMsg('msgAuth', 'Cadastro OK.', 'ok');
  setTimeout(() => mostrarApp(login.user), 500);
};

window.fazerLogin = async function() {
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;
  if (!email || !senha) return mostrarMsg('msgAuth', 'Preencha tudo.', 'err');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return mostrarMsg('msgAuth', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgAuth', 'Login OK.', 'ok');
  setTimeout(() => mostrarApp(data.user), 500);
};

window.fazerLoginCoordenador = async function() {
  const senha = document.getElementById('coordSenha').value;
  if (!senha) return mostrarMsg('msgAuth', 'Digite a senha.', 'err');
  const { data: cfg } = await supabase.from('config').select('senha_coordenador').eq('id', 1).single();
  if (!cfg || cfg.senha_coordenador !== senha) return mostrarMsg('msgAuth', 'Senha incorreta.', 'err');
  coordenadorLogado = true;
  document.getElementById('telaAuth').classList.add('hidden');
  document.getElementById('telaCoord').classList.remove('hidden');
  carregarFinanceiro();
  carregarCoordInfo();
  iniciarBotCoord();
};

window.fazerLoginTrabalhador = async function() {
  const email = document.getElementById('trabEmail').value.trim().toLowerCase();
  const pin = document.getElementById('trabPin').value.trim();
  if (!email || !pin) return mostrarMsg('msgAuth', 'Preencha e-mail e PIN.', 'err');
  if (!/^\d{4}$/.test(pin)) return mostrarMsg('msgAuth', 'PIN precisa ser 4 dígitos.', 'err');
  const { data, error } = await supabase.from('funcionarios').select('*').eq('email', email).eq('pin', pin).maybeSingle();
  if (error || !data) return mostrarMsg('msgAuth', 'E-mail ou PIN incorreto.', 'err');
  trabalhadorAtual = data;
  mostrarMsg('msgAuth', 'Login OK.', 'ok');
  if (!data.cargo) {
    setTimeout(() => {
      document.getElementById('telaAuth').classList.add('hidden');
      document.getElementById('telaCargo').classList.remove('hidden');
    }, 500);
  } else {
    setTimeout(() => mostrarAppTrabalhador(), 500);
  }
};

window.escolherCargo = async function(cargo) {
  const { error } = await supabase.from('funcionarios').update({ cargo }).eq('id', trabalhadorAtual.id);
  if (error) return mostrarMsg('msgCargo', 'Erro: ' + error.message, 'err');
  trabalhadorAtual.cargo = cargo;
  document.getElementById('telaCargo').classList.add('hidden');
  mostrarAppTrabalhador();
};

function mostrarAppTrabalhador() {
  document.getElementById('telaAuth').classList.add('hidden');
  document.getElementById('telaCargo').classList.add('hidden');
  document.getElementById('telaTrab').classList.remove('hidden');
  montarMenuTrab();
  trocarAbaTrab('inicio');
  iniciarBotTrab();
}

const CARGOS = {
  tecnico: {
    nome: 'Técnico de Manutenção',
    abas: [
      { id: 'inicio', nome: 'Início' },
      { id: 'manutencoes', nome: 'Manutenções' },
      { id: 'enviados', nome: 'Enviados' },
      { id: 'config', nome: 'Configurações' }
    ]
  },
  atendente: {
    nome: 'Atendente',
    abas: [
      { id: 'inicio', nome: 'Início' },
      { id: 'usuarios', nome: 'Usuários' },
      { id: 'suporte', nome: 'Suporte' },
      { id: 'config', nome: 'Configurações' }
    ]
  }
};

function montarMenuTrab() {
  const cfg = CARGOS[trabalhadorAtual.cargo];
  if (!cfg) return;
  document.getElementById('trabLogo').textContent = cfg.nome;
  document.getElementById('trabMenu').innerHTML = cfg.abas.map(a => `
    <button id="tabTrab-${a.id}" class="nav-item" onclick="trocarAbaTrab('${a.id}')">${a.nome}</button>
  `).join('');
}

window.trocarAbaTrab = function(aba) {
  abaTrabAtual = aba;
  const cfg = CARGOS[trabalhadorAtual.cargo];
  if (!cfg) return;
  cfg.abas.forEach(a => {
    const b = document.getElementById('tabTrab-' + a.id);
    if (b) b.classList.remove('active');
  });
  const tab = document.getElementById('tabTrab-' + aba);
  if (tab) tab.classList.add('active');
  renderAbaTrab(aba);
};

async function renderAbaTrab(aba) {
  const div = document.getElementById('trabConteudo');
  const t = trabalhadorAtual;

  if (aba === 'inicio') {
    if (t.cargo === 'atendente') {
      const { data: usuarios } = await supabase.from('profiles').select('*');
      const { data: cobr } = await supabase.from('cobrancas').select('*').eq('status', 'pendente');
      const pendentes = (cobr || []).length;
      const total = (usuarios || []).length;
      const pagos = total - pendentes;
      div.innerHTML = `<div class="card">
        <h2>Início</h2>
        <p>Bem-vindo, ${t.email}</p>
        <div class="info-box"><strong>Cargo:</strong> Atendente</div>
        <div class="total-box">
          <h3>USUÁRIOS EM DIA</h3>
          <div class="valor">${pagos} <small style="font-size:16px;opacity:.8">de ${total}</small></div>
        </div>
        <div class="info-box" style="border-left-color:#dc3545"><strong>Boletos pendentes:</strong> ${pendentes}</div>
      </div>`;
      return;
    }
    div.innerHTML = `<div class="card"><h2>Início</h2><p>Bem-vindo, ${t.email}</p>
      <div class="info-box"><strong>Cargo:</strong> ${CARGOS[t.cargo].nome}</div>
      <div class="info-box"><strong>ID:</strong> ${t.id}</div></div>`;
    return;
  }

  if (aba === 'config') {
    div.innerHTML = `<div class="card"><h2>Configurações</h2>
      <div class="info-box"><strong>PIN:</strong> <span style="letter-spacing:3px;color:#4db8ff;font-size:20px">${t.pin}</span></div>
      <div class="info-box"><strong>E-mail:</strong><br>${t.email}</div>
      <div class="info-box"><strong>ID da conta:</strong> ${t.id}</div>
      <div class="info-box"><strong>Cargo:</strong> ${CARGOS[t.cargo].nome}</div>
      <p style="color:#8fb8e0;font-size:13px">Para trocar de cargo, fale com o coordenador.</p>
    </div>`;
    return;
  }

  if (aba === 'manutencoes' && t.cargo === 'tecnico') { await renderManutencoes(div, t); return; }
  if (aba === 'enviados' && t.cargo === 'tecnico') { await renderEnviadosTecnico(div, t); return; }
  if (aba === 'usuarios' && t.cargo === 'atendente') { await renderUsuariosAtendente(div, t); return; }
  if (aba === 'suporte' && t.cargo === 'atendente') { await renderSuporteAtendente(div, t); return; }

  div.innerHTML = `<div class="card"><h2>${aba}</h2><div class="info-box">Em breve.</div></div>`;
}

async function renderManutencoes(div, t) {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: atends } = await supabase.from('atendimentos').select('*').eq('funcionario_email', t.email).eq('data', hoje);
  const totalHoje = atends?.length || 0;
  const { data: usuarios } = await supabase.from('profiles').select('*').order('email');

  div.innerHTML = `<div class="card">
    <h2>Manutenções</h2>
    <div class="total-box">
      <h3>ATENDIMENTOS HOJE</h3>
      <div class="valor">${totalHoje}</div>
    </div>
    <button class="btn-ok" onclick="registrarAtendimento()">Registrar atendimento</button>
    <hr>
    <h3>Congelar dispositivo do usuário</h3>
    <div id="listaCongelar"></div>
  </div>`;

  const cont = document.getElementById('listaCongelar');
  if (!usuarios?.length) { cont.innerHTML = '<p>Nenhum usuário.</p>'; return; }
  cont.innerHTML = usuarios.map(u => `
    <div class="user-row ${u.congelado ? 'pendente' : ''}">
      <div>
        <div class="nome">${u.email}</div>
        <div class="email">${u.congelado ? 'CONGELADO' : 'Ativo'}</div>
      </div>
      <button class="${u.congelado ? 'btn-ok' : 'btn-sec'}" onclick="congelarUsuario('${u.id}', ${u.congelado})">${u.congelado ? 'Descongelar' : 'Congelar'}</button>
    </div>
  `).join('');
}

window.registrarAtendimento = async function() {
  const { error } = await supabase.from('atendimentos').insert({ funcionario_email: trabalhadorAtual.email });
  if (error) return mostrarMsg('msgTrab', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgTrab', 'Atendimento registrado.', 'ok');
  renderAbaTrab('manutencoes');
};

window.congelarUsuario = async function(id, atual) {
  const { error } = await supabase.from('profiles').update({ congelado: !atual }).eq('id', id);
  if (error) return mostrarMsg('msgTrab', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgTrab', atual ? 'Descongelado.' : 'Congelado.', 'ok');
  renderAbaTrab('manutencoes');
};

async function renderEnviadosTecnico(div, t) {
  const { data: funcAtual } = await supabase.from('funcionarios').select('*').eq('id', t.id).single();
  if (funcAtual) trabalhadorAtual.livre = funcAtual.livre;
  const livre = trabalhadorAtual.livre !== false;
  const { data } = await supabase.from('suporte').select('*').eq('enviada', true).eq('tecnico_email', t.email).order('criado_em', { ascending: false });
  const total = (data || []).length;
  const naoLidas = (data || []).filter(m => !m.lido).length;
  if (total > ultimoTotalEnviados && ultimoTotalEnviados > 0) mostrarToast('Nova mensagem recebida.', 'ok');
  ultimoTotalEnviados = total;

  div.innerHTML = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h2 style="margin:0">Enviados</h2>
      <button class="${livre ? 'btn-ok' : 'btn-danger'}" style="width:auto;padding:10px 18px;margin:0" onclick="toggleLivreTecnico()">
        ${livre ? 'LIVRE' : 'NÃO LIVRE'}
      </button>
    </div>
    <p>${livre ? 'Você está <strong style="color:#4ade80">LIVRE</strong> para receber mensagens.' : 'Você está <strong style="color:#ff6b7d">NÃO LIVRE</strong>.'}</p>
    ${naoLidas > 0 ? `<div class="info-box" style="border-left-color:#ffc107;background:#2a2210"><strong>${naoLidas} nova(s) não lida(s)</strong></div>` : ''}
    <div id="listaEnvTec"></div>
  </div>`;

  const cont = document.getElementById('listaEnvTec');
  if (!data?.length) { cont.innerHTML = '<p>Nenhuma mensagem enviada ainda.</p>'; return; }
  cont.innerHTML = data.map(m => {
    const enderecoTxt = (m.rua || m.endereco) ? `Rua: ${m.rua || '—'} • Endereço: ${m.endereco || '—'}` : 'Endereço não informado';
    return `<div class="msg-item ${m.resolvida ? 'lido' : ''}">
      <strong>${m.email_usuario || 'Usuário'}</strong><br>
      <small>${enderecoTxt}</small>
      <p style="margin:10px 0">${m.mensagem}</p>
      <small>${new Date(m.criado_em).toLocaleString('pt-BR')}</small>
      <br>
      ${m.resolvida ? `<span style="color:#4ade80;font-weight:700">Resolvido</span>` :
        `<button class="btn-ok" style="margin-top:8px;width:auto;padding:6px 12px" onclick="marcarResolvida(${m.id})">Marcar como resolvido</button>`}
    </div>`;
  }).join('');
}

window.toggleLivreTecnico = async function() {
  const novo = !(trabalhadorAtual.livre !== false);
  const { error } = await supabase.from('funcionarios').update({ livre: novo }).eq('id', trabalhadorAtual.id);
  if (error) return mostrarMsg('msgTrab', 'Erro: ' + error.message, 'err');
  trabalhadorAtual.livre = novo;
  mostrarMsg('msgTrab', novo ? 'Você está LIVRE.' : 'Você está NÃO LIVRE.', 'ok');
  renderAbaTrab('enviados');
};

window.marcarResolvida = async function(id) {
  const { error } = await supabase.from('suporte').update({ resolvida: true, lido: true }).eq('id', id);
  if (error) return mostrarMsg('msgTrab', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgTrab', 'Marcado como resolvido.', 'ok');
  renderAbaTrab('enviados');
};

async function renderUsuariosAtendente(div, t) {
  const mes = mesAtualStr();
  const { data: usuarios } = await supabase.from('profiles').select('*').order('email');
  const { data: cobr } = await supabase.from('cobrancas').select('*');
  div.innerHTML = `<div class="card"><h2>Usuários</h2><p>Veja o status de pagamento de cada usuário.</p><div id="listaUsuAtend"></div></div>`;
  const cont = document.getElementById('listaUsuAtend');
  if (!usuarios?.length) { cont.innerHTML = '<p>Nenhum usuário cadastrado.</p>'; return; }
  cont.innerHTML = usuarios.map(u => {
    const pagas = (cobr || []).filter(c => c.user_id === u.id && c.status === 'pago').length;
    const pend = (cobr || []).filter(c => c.user_id === u.id && c.status === 'pendente').length;
    const parada = pend > 0;
    const boletoMes = (cobr || []).find(c => c.user_id === u.id && c.mes_referencia === mes);
    const fisicoPendente = u.forma_pagamento === 'fisico' && (!boletoMes || boletoMes.status !== 'pago');
    const tagForma = u.forma_pagamento === 'fisico' ? '<span class="tag-fisico">FÍSICO</span>' : (u.forma_pagamento === 'digital' ? '<span class="tag-digital">DIGITAL</span>' : '');
    return `<div class="user-row ${parada ? 'pendente' : 'pago'}">
      <div>
        <div class="nome">${u.email} ${tagForma}</div>
        <div class="email">${parada ? 'PENDENTE' : 'EM DIA'} • ${pagas} pagas • ${pend} pendentes${u.congelado ? ' • CONGELADO' : ''}</div>
      </div>
      <div class="acoes">
        ${fisicoPendente ? `<button class="btn-ok" onclick="marcarPagoAtendente('${u.id}')">Marcar como pago</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

window.marcarPagoAtendente = async function(userId) {
  const mes = mesAtualStr();
  const { data: perfil } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (!perfil) return mostrarMsg('msgTrab', 'Usuário não encontrado.', 'err');
  const valor = Number(perfil.valor_conta || 87.30);
  const { data: existente } = await supabase.from('cobrancas').select('*').eq('user_id', userId).eq('mes_referencia', mes).maybeSingle();
  if (existente) {
    const { error } = await supabase.from('cobrancas').update({ status: 'pago' }).eq('id', existente.id);
    if (error) return mostrarMsg('msgTrab', 'Erro: ' + error.message, 'err');
  } else {
    const { error } = await supabase.from('cobrancas').insert({ user_id: userId, valor, mes_referencia: mes, status: 'pago' });
    if (error) return mostrarMsg('msgTrab', 'Erro: ' + error.message, 'err');
  }
  mostrarMsg('msgTrab', `Pagamento de ${perfil.email} registrado.`, 'ok');
  renderAbaTrab('usuarios');
};

async function renderSuporteAtendente(div, t) {
  const { data, error } = await supabase.from('suporte').select('*').order('criado_em', { ascending: false });
  if (error) { div.innerHTML = `<div class="card"><h2>Suporte</h2><p>Erro ao carregar: ${error.message}</p></div>`; return; }
  div.innerHTML = `<div class="card"><h2>Suporte — Reclamações</h2><p>Envie as reclamações para um técnico livre.</p><div id="listaSupAtend"></div></div>`;
  const cont = document.getElementById('listaSupAtend');
  if (!data?.length) { cont.innerHTML = '<p>Nenhum aviso por enquanto.</p>'; return; }
  cont.innerHTML = data.map(m => {
    const enderecoTxt = (m.rua || m.endereco) ? `${m.rua || '—'} • ${m.endereco || '—'}` : 'Endereço não informado';
    return `<div class="msg-item ${m.enviada ? 'lido' : ''}">
      <strong>${m.email_usuario || 'Usuário'}</strong><br>
      <small>${enderecoTxt}</small>
      <p style="margin:8px 0">${m.mensagem}</p>
      <small>${new Date(m.criado_em).toLocaleString('pt-BR')}</small>
      <br>
      ${m.enviada ? `<span style="color:#4ade80;font-weight:700">Enviada para ${m.tecnico_email || 'técnico'}</span>` :
        `<button class="btn-ok" style="margin-top:8px;width:auto;padding:6px 12px" onclick="abrirModalEnvioTecnico(${m.id})">Enviar para Técnico</button>`}
    </div>`;
  }).join('');
}

window.abrirModalEnvioTecnico = async function(id) {
  suporteSelecionadoId = id;
  tecnicoEscolhidoEmail = null;
  const { data: msg } = await supabase.from('suporte').select('*').eq('id', id).single();
  document.getElementById('modalRua').value = msg?.rua || '';
  document.getElementById('modalEndereco').value = msg?.endereco || '';
  document.getElementById('msgModalTec').className = 'msg';
  document.getElementById('msgModalTec').textContent = '';
  const { data: tecnicos, error } = await supabase.from('funcionarios').select('*').eq('cargo', 'tecnico').eq('livre', true);
  const cont = document.getElementById('listaTecnicosLivres');
  if (error) { cont.innerHTML = `<p style="color:#ff8fa3">Erro ao buscar técnicos: ${error.message}</p>`; }
  else if (!tecnicos?.length) { cont.innerHTML = '<p style="color:#ff8fa3">Nenhum técnico LIVRE no momento.</p>'; }
  else {
    cont.innerHTML = tecnicos.map(t => `
      <div class="tec-opcao" onclick="escolherTecnico('${t.email}')" id="tec-${t.email.replace(/[@.]/g,'')}" style="padding:12px;border-radius:8px;background:#0a1428;margin-bottom:6px;cursor:pointer;border-left:4px solid #1e6fff">
        <strong>${t.email}</strong>
      </div>
    `).join('');
  }
  document.getElementById('modalEnvioTecnico').classList.remove('hidden');
};

window.escolherTecnico = function(email) {
  tecnicoEscolhidoEmail = email;
  document.querySelectorAll('.tec-opcao').forEach(el => { el.style.background = '#0a1428'; el.style.borderLeftColor = '#1e6fff'; });
  const el = document.getElementById('tec-' + email.replace(/[@.]/g,''));
  if (el) { el.style.background = '#1e3a6f'; el.style.borderLeftColor = '#4db8ff'; }
};

window.fecharModalTecnico = function() {
  document.getElementById('modalEnvioTecnico').classList.add('hidden');
  suporteSelecionadoId = null;
  tecnicoEscolhidoEmail = null;
};

window.confirmarEnvioTecnico = async function() {
  const rua = document.getElementById('modalRua').value.trim();
  const endereco = document.getElementById('modalEndereco').value.trim();
  if (!rua) return mostrarMsg('msgModalTec', 'Informe a rua.', 'err');
  if (!endereco) return mostrarMsg('msgModalTec', 'Informe o endereço.', 'err');
  if (!tecnicoEscolhidoEmail) return mostrarMsg('msgModalTec', 'Escolha um técnico.', 'err');
  const { error } = await supabase.from('suporte').update({
    enviada: true, rua, endereco, tecnico_email: tecnicoEscolhidoEmail, atendente_email: trabalhadorAtual.email
  }).eq('id', suporteSelecionadoId);
  if (error) return mostrarMsg('msgModalTec', 'Erro: ' + error.message, 'err');
  mostrarToast('Enviado para ' + tecnicoEscolhidoEmail, 'ok');
  fecharModalTecnico();
  renderAbaTrab('suporte');
};

async function mostrarApp(user) {
  usuarioAtual = user;
  document.getElementById('telaAuth').classList.add('hidden');
  document.getElementById('telaApp').classList.remove('hidden');
  await carregarPerfil();
  await verificarContaParada();
  iniciarBotUser();
}

async function carregarPerfil() {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', usuarioAtual.id).single();
  if (error || !data) {
    await supabase.from('profiles').insert({ id: usuarioAtual.id, email: usuarioAtual.email, consumo_m3: 12.5, valor_conta: 87.30 });
    return;
  }
  document.getElementById('infoId').textContent = data.id;
  document.getElementById('infoEmail').textContent = data.email;
  document.getElementById('formaPagamento').value = data.forma_pagamento ?? '';
  document.getElementById('editRua').value = data.rua || '';
  document.getElementById('editEndereco').value = data.endereco || '';
  document.getElementById('editPessoas').value = data.num_pessoas || 1;
  document.getElementById('editLavaJato').value = data.lava_jato ? 'sim' : 'nao';
  atualizarSensor(data);
  atualizarEstimativaVazamento(data);
}

function atualizarSensor(data) {
  const pessoas = data.num_pessoas || 1;
  const consumo = Number(data.consumo_m3 || 12.5);
  const temLava = data.lava_jato ? 1 : 0;
  let nivel = Math.round(consumo * 2 + pessoas * 5 + temLava * 10);
  if (nivel > 200) nivel = 200;
  if (nivel < 0) nivel = 0;
  nivelSensorSimulado = nivel;
  const cor = corSensor(nivel);
  const texto = textoStatusSensor(cor);
  const luz = document.getElementById('luzDispositivo');
  const status = document.getElementById('statusDispositivo');
  const frase = document.getElementById('fraseDispositivo');
  const card = document.getElementById('cardDispositivo');
  if (!luz) return;
  luz.textContent = texto.icone;
  status.textContent = texto.status;
  frase.textContent = texto.frase;
  card.className = 'dispositivo-card cor-' + cor;
  const fill = document.getElementById('sensorFill');
  if (fill) {
    fill.style.width = (nivel / 200 * 100) + '%';
    fill.style.background = cor === 'verde' ? '#4ade80' : (cor === 'amarelo' ? '#ffc107' : '#dc3545');
  }
}

function atualizarEstimativaVazamento(data) {
  const pessoas = data.num_pessoas || 1;
  const consumo = Number(data.consumo_m3 || 0);
  const temLava = data.lava_jato ? 1 : 0;
  const esperado = pessoas * 5 + (temLava ? 3 : 0);
  const icone = document.getElementById('vazIcone');
  const titulo = document.getElementById('vazTitulo');
  const frase = document.getElementById('vazFrase');
  if (consumo > esperado * 1.3) {
    icone.textContent = '!';
    titulo.textContent = 'Possível vazamento!';
    frase.textContent = `Seu consumo (${consumo} m³) está acima do esperado (${esperado} m³). Avise o técnico.`;
  } else {
    icone.textContent = 'OK';
    titulo.textContent = 'Sem sinais de vazamento';
    frase.textContent = `Consumo dentro do esperado (${esperado} m³).`;
  }
}

window.salvarEndereco = async function() {
  const rua = document.getElementById('editRua').value.trim();
  const endereco = document.getElementById('editEndereco').value.trim();
  const pessoas = document.getElementById('editPessoas').value;
  const lava = document.getElementById('editLavaJato').value;
  if (!rua) return mostrarMsg('msgApp', 'Informe a rua.', 'err');
  if (!endereco) return mostrarMsg('msgApp', 'Informe o endereço.', 'err');
  if (!pessoas) return mostrarMsg('msgApp', 'Informe quantas pessoas moram na casa.', 'err');
  if (!lava) return mostrarMsg('msgApp', 'Informe se tem lava-jato.', 'err');
  const { error } = await supabase.from('profiles').update({ rua, endereco, num_pessoas: Number(pessoas), lava_jato: lava === 'sim' }).eq('id', usuarioAtual.id);
  if (error) return mostrarMsg('msgApp', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgApp', 'Endereço atualizado.', 'ok');
  carregarPerfil();
};

window.simularAlerta = function() { mostrarAlertaGrande('ATENÇÃO', 'Possível vazamento detectado. Avise o técnico.'); };

async function verificarContaParada() {
  const { data } = await supabase.from('cobrancas').select('*').eq('user_id', usuarioAtual.id).eq('status', 'pendente');
  contaParada = !!(data && data.length > 0);
  const aviso = document.getElementById('avisoParada');
  if (contaParada) {
    const valor = data.reduce((s, c) => s + Number(c.valor), 0);
    aviso.classList.remove('hidden');
    aviso.innerHTML = `<strong>CONTA PARADA</strong> — Você tem <strong>${data.length}</strong> boleto(s) em aberto (total R$ ${valor.toFixed(2).replace('.', ',')}). Pague para destravar.`;
    ['tabConta','tabConfig','tabInfo'].forEach(id => { const b = document.getElementById(id); if (b) { b.style.opacity = '0.4'; b.style.pointerEvents = 'none'; } });
    const tabCobr = document.getElementById('tabCobr');
    if (tabCobr) { tabCobr.style.opacity = '1'; tabCobr.style.pointerEvents = 'auto'; }
    trocarAba('cobr');
  } else {
    aviso.classList.add('hidden');
    aviso.innerHTML = '';
    ['tabConta','tabConfig','tabInfo'].forEach(id => { const b = document.getElementById(id); if (b) { b.style.opacity = '1'; b.style.pointerEvents = 'auto'; } });
  }
}

window.trocarAba = function(aba) {
  if (contaParada && aba !== 'cobr') return mostrarMsg('msgApp', 'Sua conta está parada. Pague os boletos pendentes para liberar.', 'err');
  ['info','conta','config','cobr'].forEach(a => {
    document.getElementById('aba' + a.charAt(0).toUpperCase() + a.slice(1)).classList.add('hidden');
    document.getElementById('tab' + a.charAt(0).toUpperCase() + a.slice(1)).classList.remove('active');
  });
  document.getElementById('aba' + aba.charAt(0).toUpperCase() + aba.slice(1)).classList.remove('hidden');
  document.getElementById('tab' + aba.charAt(0).toUpperCase() + aba.slice(1)).classList.add('active');
  if (aba === 'cobr') carregarCobrancas();
  if (aba === 'conta') carregarConta();
};

window.trocarSenha = async function() {
  if (contaParada) return mostrarMsg('msgApp', 'Pague os boletos pendentes.', 'err');
  const antiga = document.getElementById('senhaAntiga').value;
  const nova = document.getElementById('senhaNova').value;
  const nova2 = document.getElementById('senhaNova2').value;
  if (!antiga || !nova) return mostrarMsg('msgApp', 'Preencha as senhas.', 'err');
  if (nova.length < 6) return mostrarMsg('msgApp', 'Senha 6+ caracteres.', 'err');
  if (nova !== nova2) return mostrarMsg('msgApp', 'Senhas não coincidem.', 'err');
  const { error: errLogin } = await supabase.auth.signInWithPassword({ email: usuarioAtual.email, password: antiga });
  if (errLogin) return mostrarMsg('msgApp', 'Senha antiga incorreta.', 'err');
  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) return mostrarMsg('msgApp', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgApp', 'Senha alterada.', 'ok');
  document.getElementById('senhaAntiga').value = '';
  document.getElementById('senhaNova').value = '';
  document.getElementById('senhaNova2').value = '';
};

window.salvarFormaPagamento = async function() {
  if (contaParada) return mostrarMsg('msgApp', 'Pague os boletos pendentes.', 'err');
  const forma = document.getElementById('formaPagamento').value;
  if (!forma) return mostrarMsg('msgApp', 'Escolha uma forma.', 'err');
  const { error } = await supabase.from('profiles').update({ forma_pagamento: forma }).eq('id', usuarioAtual.id);
  if (error) return mostrarMsg('msgApp', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgApp', 'Forma salva.', 'ok');
};

window.enviarSuporte = async function() {
  if (contaParada) return mostrarMsg('msgApp', 'Pague os boletos pendentes.', 'err');
  const msg = document.getElementById('msgSuporte').value.trim();
  if (!msg) return mostrarMsg('msgApp', 'Descreva o problema.', 'err');
  const { data: perfil } = await supabase.from('profiles').select('rua, endereco').eq('id', usuarioAtual.id).single();
  const { error } = await supabase.from('suporte').insert({ user_id: usuarioAtual.id, email_usuario: usuarioAtual.email, mensagem: msg, rua: perfil?.rua || null, endereco: perfil?.endereco || null });
  if (error) return mostrarMsg('msgApp', 'Erro: ' + error.message, 'err');
  document.getElementById('msgSuporte').value = '';
  mostrarMsg('msgApp', 'Aviso enviado.', 'ok');
};

async function carregarCobrancas() {
  const { data, error } = await supabase.from('cobrancas').select('*').eq('user_id', usuarioAtual.id).order('criado_em', { ascending: false });
  const div = document.getElementById('listaCobrancas');
  if (error) { div.innerHTML = '<p>Erro.</p>'; return; }
  if (!data || !data.length) { div.innerHTML = '<p>Nenhuma cobrança por aqui.</p>'; return; }
  div.innerHTML = data.map(c => `
    <div class="cobranca ${c.status === 'pago' ? 'pago' : 'pendente'}">
      <strong>R$ ${Number(c.valor).toFixed(2).replace('.', ',')}</strong><br>
      Mês: ${c.mes_referencia || '-'}<br>
      Status: <strong>${c.status}</strong><br>
      <small>${new Date(c.criado_em).toLocaleString('pt-BR')}</small>
      ${c.status !== 'pago' ? `<br><button class="btn-ok" style="margin-top:8px" onclick="pagarCobranca(${c.id})">Pagar agora</button>` : ''}
    </div>
  `).join('');
}

window.pagarCobranca = async function(id) {
  const { error } = await supabase.from('cobrancas').update({ status: 'pago' }).eq('id', id);
  if (error) return mostrarMsg('msgApp', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgApp', 'Pagamento confirmado.', 'ok');
  await carregarCobrancas();
  await verificarContaParada();
  if (!contaParada) { mostrarMsg('msgApp', 'Conta liberada.', 'ok'); trocarAba('info'); }
};

async function carregarConta() {
  if (contaParada) return;
  const { data: perfil } = await supabase.from('profiles').select('*').eq('id', usuarioAtual.id).single();
  if (perfil) {
    document.getElementById('contaConsumo').textContent = perfil.consumo_m3 ?? 0;
    document.getElementById('contaValor').textContent = Number(perfil.valor_conta ?? 0).toFixed(2).replace('.', ',');
  }
  const { data } = await supabase.from('consumo').select('*').eq('user_id', usuarioAtual.id).order('criado_em', { ascending: true });
  desenharGraficos(data || []);
}

function desenharGraficos(dados) {
  const labels = dados.map(d => d.mes);
  const consumos = dados.map(d => Number(d.consumo_m3));
  const valores = dados.map(d => Number(d.valor));
  const ctx1 = document.getElementById('graficoConsumo').getContext('2d');
  if (grafConsumo) grafConsumo.destroy();
  grafConsumo = new Chart(ctx1, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Consumo (m³)', data: consumos, borderColor: '#4db8ff', backgroundColor: 'rgba(77,184,255,0.2)', fill: true, tension: .35, pointBackgroundColor: '#1e6fff', pointBorderColor: '#fff', pointRadius: 5 }] },
    options: { responsive: true, plugins: { legend: { labels: { color: '#cfe6ff' } } }, scales: { x: { ticks: { color: '#8fb8e0' }, grid: { color: '#1e2a4d' } }, y: { ticks: { color: '#8fb8e0' }, grid: { color: '#1e2a4d' } } } }
  });
  const ctx2 = document.getElementById('graficoValor').getContext('2d');
  if (grafValor) grafValor.destroy();
  grafValor = new Chart(ctx2, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Valor (R$)', data: valores, backgroundColor: 'rgba(30,111,255,0.7)', borderColor: '#4db8ff', borderWidth: 2, borderRadius: 6 }] },
    options: { responsive: true, plugins: { legend: { labels: { color: '#cfe6ff' } } }, scales: { x: { ticks: { color: '#8fb8e0' }, grid: { color: '#1e2a4d' } }, y: { ticks: { color: '#8fb8e0' }, grid: { color: '#1e2a4d' } } } }
  });
}

window.popularHistorico = async function() {
  if (contaParada) return mostrarMsg('msgApp', 'Pague os boletos.', 'err');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set'];
  const dados = meses.map((mes, i) => ({ user_id: usuarioAtual.id, mes, consumo_m3: 10 + Math.round(Math.random() * 8 + i * .5), valor: Number((70 + i * 3 + Math.random() * 15).toFixed(2)) }));
  const { error } = await supabase.from('consumo').insert(dados);
  if (error) return mostrarMsg('msgApp', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgApp', 'Populado.', 'ok');
  carregarConta();
};

window.trocarAbaCoord = function(aba) {
  ['fin','users','func','coordinfo'].forEach(a => {
    const el = document.getElementById('aba' + a.charAt(0).toUpperCase() + a.slice(1));
    const tab = document.getElementById('tab' + a.charAt(0).toUpperCase() + a.slice(1));
    if (el) el.classList.add('hidden');
    if (tab) tab.classList.remove('active');
  });
  document.getElementById('aba' + aba.charAt(0).toUpperCase() + aba.slice(1)).classList.remove('hidden');
  document.getElementById('tab' + aba.charAt(0).toUpperCase() + aba.slice(1)).classList.add('active');
  if (aba === 'fin') carregarFinanceiro();
  if (aba === 'users') carregarUsuarios();
  if (aba === 'func') carregarFuncionarios();
  if (aba === 'coordinfo') carregarCoordInfo();
};

async function carregarFinanceiro() {
  const mes = mesAtualStr();
  const { data: usuarios } = await supabase.from('profiles').select('*').order('email');
  const { data: cobrMes } = await supabase.from('cobrancas').select('*').eq('mes_referencia', mes);
  const div = document.getElementById('listaFinanceiro');
  let totalFaturado = 0, totalRecebido = 0, totalPendente = 0;
  if (!usuarios?.length) {
    div.innerHTML = '<p>Nenhum usuário cadastrado.</p>';
    document.getElementById('totalFaturado').textContent = '0,00';
    document.getElementById('totalRecebido').textContent = '0,00';
    document.getElementById('totalPendente').textContent = '0,00';
    return;
  }
  div.innerHTML = usuarios.map(u => {
    const c = (cobrMes || []).find(x => x.user_id === u.id);
    const valor = Number(u.valor_conta || 0);
    const status = c ? c.status : 'sem_boleto';
    const cor = status === 'pago' ? 'pago' : (status === 'pendente' ? 'pendente' : '');
    if (status === 'pendente') { totalFaturado += valor; totalPendente += valor; }
    if (status === 'pago') { totalFaturado += valor; totalRecebido += valor; }
    const tagForma = u.forma_pagamento === 'fisico' ? '<span class="tag-fisico">FÍSICO</span>' : (u.forma_pagamento === 'digital' ? '<span class="tag-digital">DIGITAL</span>' : '');
    return `<div class="user-row ${cor}">
      <div>
        <div class="nome">${u.email} ${tagForma}</div>
        <div class="email">Status: <span class="${status === 'pago' ? 'status-pago' : 'status-pendente'}">${status === 'pago' ? 'PAGO' : (status === 'pendente' ? 'PENDENTE' : '— sem boleto')}</span>${u.congelado ? ' • CONGELADO' : ''}</div>
      </div>
      <div class="valor">R$ ${valor.toFixed(2).replace('.', ',')}</div>
    </div>`;
  }).join('');
  document.getElementById('totalFaturado').textContent = totalFaturado.toFixed(2).replace('.', ',');
  document.getElementById('totalRecebido').textContent = totalRecebido.toFixed(2).replace('.', ',');
  document.getElementById('totalPendente').textContent = totalPendente.toFixed(2).replace('.', ',');
}

window.enviarBoletosTodos = async function() {
  const mes = mesAtualStr();
  const { data: usuarios, error: e1 } = await supabase.from('profiles').select('*');
  if (e1) return mostrarMsg('msgCoord', 'Erro: ' + e1.message, 'err');
  if (!usuarios?.length) return mostrarMsg('msgCoord', 'Nenhum usuário cadastrado.', 'err');
  const { data: existentes } = await supabase.from('cobrancas').select('user_id').eq('mes_referencia', mes);
  const idsJa = new Set((existentes || []).map(e => e.user_id));
  const novos = usuarios.filter(u => !u.congelado && !idsJa.has(u.id)).map(u => ({ user_id: u.id, valor: Number(u.valor_conta || 87.30), mes_referencia: mes, status: 'pendente' }));
  if (!novos.length) return mostrarMsg('msgCoord', 'Boletos do mês já foram enviados.', 'err');
  const { error } = await supabase.from('cobrancas').insert(novos);
  if (error) return mostrarMsg('msgCoord', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgCoord', `${novos.length} boletos enviados.`, 'ok');
  carregarFinanceiro();
};

async function carregarUsuarios() {
  const { data: usuarios } = await supabase.from('profiles').select('*').order('email');
  const { data: cobr } = await supabase.from('cobrancas').select('*');
  const div = document.getElementById('listaUsuarios');
  if (!usuarios?.length) { div.innerHTML = '<p>Nenhum usuário.</p>'; return; }
  div.innerHTML = usuarios.map(u => {
    const pagas = (cobr || []).filter(c => c.user_id === u.id && c.status === 'pago').length;
    const pend = (cobr || []).filter(c => c.user_id === u.id && c.status === 'pendente').length;
    const parada = pend > 0;
    const tagForma = u.forma_pagamento === 'fisico' ? '<span class="tag-fisico">FÍSICO</span>' : (u.forma_pagamento === 'digital' ? '<span class="tag-digital">DIGITAL</span>' : '');
    return `<div class="user-row ${parada ? 'pendente' : 'pago'}">
      <div>
        <div class="nome">${u.email} ${tagForma} ${parada ? ' <span class="status-pendente">CONTA PARADA</span>' : ''}</div>
        <div class="email">${pagas} pagas • ${pend} pendentes ${u.congelado ? ' • CONGELADO' : ''}</div>
      </div>
      <div class="valor">${parada ? 'PENDENTE' : 'PAGO'}</div>
    </div>`;
  }).join('');
}

async function carregarFuncionarios() {
  const { data, error } = await supabase.from('funcionarios').select('*').order('criado_em', { ascending: false });
  const div = document.getElementById('listaFuncionarios');
  if (error) { div.innerHTML = '<p>Erro ao carregar.</p>'; return; }
  if (!data || !data.length) { div.innerHTML = '<p>Nenhum funcionário cadastrado ainda.</p>'; return; }
  const agrupado = {};
  data.forEach(f => { if (!agrupado[f.email]) agrupado[f.email] = []; agrupado[f.email].push(f); });
  div.innerHTML = Object.entries(agrupado).map(([email, pins]) => `
    <div class="user-row" style="flex-direction:column;align-items:flex-start">
      <div style="width:100%;margin-bottom:8px"><strong>${email}</strong></div>
      <div style="width:100%">
        ${pins.map(p => `
          <div style="display:flex;justify-content:space-between;align-items:center;background:#0a1428;padding:8px 12px;border-radius:8px;margin-bottom:6px;border-left:3px solid #1e6fff">
            <span>PIN: <strong style="color:#4db8ff;font-size:18px;letter-spacing:2px">${p.pin}</strong>${p.cargo ? ` <small style="color:#8fb8e0">(${p.cargo})</small>` : ''}${p.cargo === 'tecnico' ? ` <small style="color:${p.livre ? '#4ade80' : '#ff6b7d'}">${p.livre ? 'Livre' : 'Não livre'}</small>` : ''}</span>
            <span>
              <small style="color:#8fb8e0;margin-right:10px">${new Date(p.criado_em).toLocaleDateString('pt-BR')}</small>
              <button class="btn-danger" style="width:auto;padding:4px 10px;margin:0;font-size:12px" onclick="excluirFuncionario(${p.id})">Excluir</button>
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

window.criarFuncionario = async function() {
  const email = document.getElementById('funcEmail').value.trim().toLowerCase();
  const pin = document.getElementById('funcPin').value.trim();
  if (!email) return mostrarMsg('msgCoord', 'Informe o e-mail.', 'err');
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) return mostrarMsg('msgCoord', 'E-mail inválido.', 'err');
  if (!pin) return mostrarMsg('msgCoord', 'Informe o PIN.', 'err');
  if (!/^\d{4}$/.test(pin)) return mostrarMsg('msgCoord', 'PIN precisa ser 4 dígitos.', 'err');
  const { data: existente } = await supabase.from('funcionarios').select('*').eq('email', email).eq('pin', pin).maybeSingle();
  if (existente) return mostrarMsg('msgCoord', 'Este e-mail já tem este PIN.', 'err');
  const { error } = await supabase.from('funcionarios').insert({ email, pin });
  if (error) {
    if (error.message.includes('duplicate')) return mostrarMsg('msgCoord', 'Este e-mail já tem este PIN.', 'err');
    return mostrarMsg('msgCoord', 'Erro: ' + error.message, 'err');
  }
  mostrarMsg('msgCoord', `PIN ${pin} criado para ${email}.`, 'ok');
  document.getElementById('funcEmail').value = '';
  document.getElementById('funcPin').value = '';
  carregarFuncionarios();
};

window.excluirFuncionario = async function(id) {
  if (!confirm('Excluir este PIN? (ex: demissão)')) return;
  const { error } = await supabase.from('funcionarios').delete().eq('id', id);
  if (error) return mostrarMsg('msgCoord', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgCoord', 'PIN excluído.', 'ok');
  carregarFuncionarios();
};

async function carregarCoordInfo() {
  const { data } = await supabase.from('config').select('*').eq('id', 1).single();
  if (!data) return;
  document.getElementById('coordCarga').textContent = data.carga_horaria || '-';
  document.getElementById('coordAtend').textContent = data.total_atendimentos || 0;
  document.getElementById('inputCarga').value = data.carga_horaria || '';
}

window.salvarCarga = async function() {
  const v = document.getElementById('inputCarga').value.trim();
  const { error } = await supabase.from('config').update({ carga_horaria: v }).eq('id', 1);
  if (error) return mostrarMsg('msgCoord', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgCoord', 'Carga horária salva.', 'ok');
  carregarCoordInfo();
};

window.trocarSenhaCoord = async function() {
  const atual = document.getElementById('coordSenhaAtual').value;
  const nova = document.getElementById('coordSenhaNova').value;
  const nova2 = document.getElementById('coordSenhaNova2').value;
  if (!atual || !nova || !nova2) return mostrarMsg('msgSenhaCoord', 'Preencha todos os campos.', 'err');
  if (nova.length < 4) return mostrarMsg('msgSenhaCoord', 'A nova senha precisa ter 4+ caracteres.', 'err');
  if (nova !== nova2) return mostrarMsg('msgSenhaCoord', 'As senhas não coincidem.', 'err');
  const { data: cfg } = await supabase.from('config').select('senha_coordenador').eq('id', 1).single();
  if (!cfg || cfg.senha_coordenador !== atual) return mostrarMsg('msgSenhaCoord', 'Senha atual incorreta.', 'err');
  const { error } = await supabase.from('config').update({ senha_coordenador: nova }).eq('id', 1);
  if (error) return mostrarMsg('msgSenhaCoord', 'Erro: ' + error.message, 'err');
  mostrarMsg('msgSenhaCoord', 'Senha alterada com sucesso.', 'ok');
  document.getElementById('coordSenhaAtual').value = '';
  document.getElementById('coordSenhaNova').value = '';
  document.getElementById('coordSenhaNova2').value = '';
};

window.zerarAtendimentos = async function() {
  await supabase.from('config').update({ total_atendimentos: 0 }).eq('id', 1);
  mostrarMsg('msgCoord', 'Contador zerado.', 'ok');
  carregarCoordInfo();
};

const respostasUser = [
  { p: ['senha','trocar senha'], r: 'Vá em "Configurações" → "Senha".' },
  { p: ['email','e-mail'], r: 'Para trocar o e-mail, fale com o coordenador.' },
  { p: ['vazamento','acidente','problema','reportar'], r: 'Vá em "Configurações" → Suporte.' },
  { p: ['tecnico','atendente'], r: 'Seu aviso é repassado pelo atendente ao técnico.' },
  { p: ['consumo','gráfico','grafico','conta','valor'], r: 'Na aba "Conta de Água" você vê os gráficos.' },
  { p: ['dispositivo','luz','sensor'], r: 'A luz mostra: verde = bom, amarelo = atenção, vermelho = crítico.' },
  { p: ['pagar','boleto','pagamento'], r: 'Na aba "Cobranças".' },
  { p: ['parada','bloqueada'], r: 'Pague os boletos na aba "Cobranças".' },
  { p: ['endereco','endereço','rua'], r: 'Em "Configurações" → "Meu endereço".' },
  { p: ['oi','ola','olá'], r: 'Olá! Como posso ajudar?' },
  { p: ['obrigado','valeu'], r: 'Por nada!' },
  { p: ['ajuda'], r: 'Posso ajudar com: senha, e-mail, endereço, consumo, vazamento, dispositivo e cobranças.' }
];
const sugestoesUser = ['Como trocar senha?', 'Ver consumo', 'Como funciona o dispositivo?', 'Reportar vazamento'];

const respostasCoord = [
  { p: ['boleto','enviar','faturar'], r: 'Em "Financeiro" você envia os boletos do mês.' },
  { p: ['funcionario','funcionário','pin','trabalhador'], r: 'Na aba "Funcionários" você cria PINs de 4 dígitos.' },
  { p: ['usuario','usuário'], r: 'Na aba "Usuários" você vê o status de cada um.' },
  { p: ['total','faturado','faturamento'], r: 'Na aba "Financeiro" tem os totais do mês.' },
  { p: ['carga','horaria','horária'], r: 'Na aba "Informações".' },
  { p: ['senha','trocar senha'], r: 'Na aba "Informações" você troca a senha do administrador.' },
  { p: ['atendimento'], r: 'Na aba "Informações".' },
  { p: ['oi','ola'], r: 'Olá, administrador!' },
  { p: ['ajuda'], r: 'Posso ajudar com: faturamento, funcionários, usuários, carga horária e senha.' }
];
const sugestoesCoord = ['Ver faturamento', 'Criar PIN funcionário', 'Ver usuários', 'Trocar senha'];

const respostasTrab = [
  { p: ['atendimento','registrar'], r: 'Na aba "Manutenções".' },
  { p: ['enviados','livre'], r: 'Na aba "Enviados", use o botão LIVRE / NÃO LIVRE.' },
  { p: ['congelar','dispositivo'], r: 'Na aba "Manutenções".' },
  { p: ['suporte','reclamacao'], r: 'Na aba "Suporte".' },
  { p: ['cargo','pin'], r: 'Aparecem em "Configurações".' },
  { p: ['usuarios','pago'], r: 'Na aba "Usuários".' },
  { p: ['resolvido'], r: 'Na aba "Enviados".' },
  { p: ['oi','ola'], r: 'Olá! Como posso ajudar?' },
  { p: ['ajuda'], r: 'Posso ajudar com: atendimento, ficar livre, congelar, ver enviados, ver usuários.' }
];
const sugestoesTrab = ['Como registrar atendimento?', 'Como ficar livre?', 'Como congelar?', 'Ver enviados'];

function acharResposta(texto, lista) {
  const t = texto.toLowerCase();
  for (const item of lista) { if (item.p.some(p => t.includes(p))) return item.r; }
  return 'Não entendi. Digite "ajuda".';
}

function iniciarBotUser() {
  const body = document.getElementById('botUserBody');
  body.innerHTML = `<div class="bot-msg bot">Olá! Como posso ajudar?</div>`;
  const sug = document.getElementById('botUserSugestoes');
  sug.innerHTML = sugestoesUser.map(s => `<button onclick="document.getElementById('botUserInput').value='${s}';enviarBotUser()">${s}</button>`).join('');
  const input = document.getElementById('botUserInput');
  if (input) input.value = '';
}
window.enviarBotUser = function() {
  const input = document.getElementById('botUserInput');
  const texto = input.value.trim();
  if (!texto) return;
  const body = document.getElementById('botUserBody');
  body.innerHTML += `<div class="bot-msg user">${texto}</div>`;
  input.value = '';
  body.scrollTop = body.scrollHeight;
  setTimeout(() => {
    body.innerHTML += `<div class="bot-msg bot">${acharResposta(texto, respostasUser)}</div>`;
    body.scrollTop = body.scrollHeight;
  }, 350);
};

function iniciarBotCoord() {
  const body = document.getElementById('botCoordBody');
  body.innerHTML = `<div class="bot-msg bot">Olá, administrador. Como posso ajudar?</div>`;
  const sug = document.getElementById('botCoordSugestoes');
  sug.innerHTML = sugestoesCoord.map(s => `<button onclick="document.getElementById('botCoordInput').value='${s}';enviarBotCoord()">${s}</button>`).join('');
  const input = document.getElementById('botCoordInput');
  if (input) input.value = '';
}
window.enviarBotCoord = function() {
  const input = document.getElementById('botCoordInput');
  const texto = input.value.trim();
  if (!texto) return;
  const body = document.getElementById('botCoordBody');
  body.innerHTML += `<div class="bot-msg user">${texto}</div>`;
  input.value = '';
  body.scrollTop = body.scrollHeight;
  setTimeout(() => {
    body.innerHTML += `<div class="bot-msg bot">${acharResposta(texto, respostasCoord)}</div>`;
    body.scrollTop = body.scrollHeight;
  }, 350);
};

function iniciarBotTrab() {
  const body = document.getElementById('botTrabBody');
  body.innerHTML = `<div class="bot-msg bot">Olá! Como posso ajudar?</div>`;
  const sug = document.getElementById('botTrabSugestoes');
  sug.innerHTML = sugestoesTrab.map(s => `<button onclick="document.getElementById('botTrabInput').value='${s}';enviarBotTrab()">${s}</button>`).join('');
  const input = document.getElementById('botTrabInput');
  if (input) input.value = '';
}
window.enviarBotTrab = function() {
  const input = document.getElementById('botTrabInput');
  const texto = input.value.trim();
  if (!texto) return;
  const body = document.getElementById('botTrabBody');
  body.innerHTML += `<div class="bot-msg user">${texto}</div>`;
  input.value = '';
  body.scrollTop = body.scrollHeight;
  setTimeout(() => {
    body.innerHTML += `<div class="bot-msg bot">${acharResposta(texto, respostasTrab)}</div>`;
    body.scrollTop = body.scrollHeight;
  }, 350);
};

boot();