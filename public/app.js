const API = '/api';

// ==========================================
// TEMA CLARO / OSCURO
// ==========================================
function aplicarTemaGuardado() {
  const tema = localStorage.getItem('tema') || 'claro';
  if (tema === 'oscuro') {
    document.body.classList.add('oscuro');
  } else {
    document.body.classList.remove('oscuro');
  }
  actualizarTextoBotonesTema();
}

function actualizarTextoBotonesTema() {
  const esOscuro = document.body.classList.contains('oscuro');
  const btnApp = document.getElementById('btn-tema');
  const btnLogin = document.getElementById('btn-tema-login');
  if (btnApp) btnApp.textContent = esOscuro ? '☀️ Claro' : '🌙 Oscuro';
  if (btnLogin) btnLogin.textContent = esOscuro ? '☀️' : '🌙';
}

function alternarTema() {
  document.body.classList.toggle('oscuro');
  localStorage.setItem('tema', document.body.classList.contains('oscuro') ? 'oscuro' : 'claro');
  actualizarTextoBotonesTema();
}

const btnTemaLogin = document.getElementById('btn-tema-login');
if (btnTemaLogin) btnTemaLogin.addEventListener('click', alternarTema);

const btnTema = document.getElementById('btn-tema');
if (btnTema) btnTema.addEventListener('click', alternarTema);

aplicarTemaGuardado();

// ==========================================
// AUTENTICACIÓN Y SESIÓN (JWT)
// ==========================================
function getToken() { return localStorage.getItem('token'); }
function setToken(t) { localStorage.setItem('token', t); }
function clearToken() { localStorage.removeItem('token'); localStorage.removeItem('usuario'); }
function getUsuarioActual() {
  try {
    return JSON.parse(localStorage.getItem('usuario') || '{}');
  } catch {
    return {};
  }
}

async function apiFetch(url, options = {}) {
  options.headers = options.headers || {};
  const token = getToken();
  if (token) {
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  if (options.body && typeof options.body === 'string') {
    options.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, options);
  if (res.status === 401) {
    clearToken();
    mostrarLogin('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
    throw new Error('No autorizado');
  }
  return res;
}

function mostrarMensaje(id, texto, tipo) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className = 'mensaje ' + tipo;
  setTimeout(() => {
    if (el.textContent === texto) {
      el.textContent = '';
      el.className = 'mensaje';
    }
  }, 4000);
}

// ==========================================
// PESTAÑAS Y NAVEGACIÓN (RBAC VE-005)
// ==========================================
const TABS_VALIDOS = ['productos', 'compras', 'ventas', 'clientes', 'proveedores', 'alertas', 'critico', 'vendedores', 'reportes'];

function obtenerTabDeHash() {
  const hash = window.location.hash.replace('#', '').trim().toLowerCase();
  return TABS_VALIDOS.includes(hash) ? hash : 'productos';
}

function activarTab(tab, actualizarHash = true) {
  let tabFinal = TABS_VALIDOS.includes(tab) ? tab : 'productos';

  const usuario = getUsuarioActual();
  const esAdmin = usuario.rol === 'Administrador' || usuario.id_rol === 1;

  // Control de acceso por rol: Si no es administrador, no puede acceder a vendedores
  if (tabFinal === 'vendedores' && !esAdmin) {
    tabFinal = 'productos';
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabFinal);
  });
  document.querySelectorAll('.tab-content').forEach(sec => {
    sec.classList.toggle('active', sec.id === 'tab-' + tabFinal);
  });

  if (actualizarHash && window.location.hash !== '#' + tabFinal) {
    window.location.hash = '#' + tabFinal;
  }

  cargarSeccion(tabFinal);
}

function mostrarLogin(mensajeError) {
  document.getElementById('pantalla-login').classList.remove('oculto');
  document.getElementById('app').classList.add('oculto');
  if (mensajeError) mostrarMensaje('msg-login', mensajeError, 'error');
}

function mostrarApp() {
  document.getElementById('pantalla-login').classList.add('oculto');
  document.getElementById('app').classList.remove('oculto');

  const usuario = getUsuarioActual();
  const esAdmin = usuario.rol === 'Administrador' || usuario.id_rol === 1;

  document.getElementById('usuario-activo').textContent = usuario.nombre ? `Hola, ${usuario.nombre}` : '';

  // VE-005: Ocultar pestaña vendedores si el usuario no es Administrador
  const tabVendedoresBtn = document.querySelector('.tab-btn[data-tab="vendedores"]');
  if (tabVendedoresBtn) {
    if (esAdmin) {
      tabVendedoresBtn.classList.remove('oculto');
    } else {
      tabVendedoresBtn.classList.add('oculto');
    }
  }

  inicializarApp();
  const tabDestino = obtenerTabDeHash();
  activarTab(tabDestino, true);
}

async function verificarSesion() {
  if (!getToken()) {
    mostrarLogin();
    return;
  }
  try {
    const res = await fetch(`${API}/auth/me`, { headers: { Authorization: 'Bearer ' + getToken() } });
    if (res.ok) {
      mostrarApp();
    } else {
      clearToken();
      mostrarLogin('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
    }
  } catch {
    mostrarLogin();
  }
}

// ==========================================
// PANTALLA LOGIN (LG-015, LG-016, LG-011)
// ==========================================
// LG-015: Mostrar u ocultar contraseña con el botón de ojo
const btnVerClave = document.getElementById('btn-ver-clave');
if (btnVerClave) {
  btnVerClave.addEventListener('click', () => {
    const inputClave = document.getElementById('login-password');
    if (!inputClave) return;
    const esPassword = inputClave.type === 'password';
    inputClave.type = esPassword ? 'text' : 'password';
    btnVerClave.textContent = esPassword ? '🙈' : '👁️';
    btnVerClave.title = esPassword ? 'Ocultar contraseña' : 'Mostrar contraseña';
  });
}

// LG-016: Recuperar contraseña
const linkOlvido = document.getElementById('link-olvido');
const modalOlvido = document.getElementById('modal-olvido');
const formOlvido = document.getElementById('form-olvido');
if (linkOlvido && modalOlvido) {
  linkOlvido.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('olvido-correo').value = document.getElementById('login-correo').value || '';
    document.getElementById('msg-olvido').textContent = '';
    modalOlvido.classList.remove('oculto');
  });
}
if (formOlvido) {
  formOlvido.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = document.getElementById('olvido-correo').value.trim();
    try {
      const res = await fetch(`${API}/auth/recuperar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo })
      });
      const data = await res.json();
      mostrarMensaje('msg-olvido', data.mensaje || 'Solicitud enviada.', 'exito');
      setTimeout(() => {
        modalOlvido.classList.add('oculto');
      }, 3000);
    } catch {
      mostrarMensaje('msg-olvido', 'Error de conexión con el servidor.', 'error');
    }
  });
}

// Iniciar sesión
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const correo = document.getElementById('login-correo').value.trim();
  const password = document.getElementById('login-password').value;

  if (!correo.includes('@')) {
    mostrarMensaje('msg-login', 'El correo debe incluir un @.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password })
    });
    const data = await res.json();
    if (res.ok) {
      setToken(data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      mostrarApp();
    } else {
      mostrarMensaje('msg-login', data.error || 'Correo o contraseña incorrectos.', 'error');
    }
  } catch {
    mostrarMensaje('msg-login', 'Error de conexión con el servidor.', 'error');
  }
});

// LG-011: Cerrar sesión e invalidar token en backend
document.getElementById('btn-logout').addEventListener('click', async () => {
  try {
    await apiFetch(`${API}/auth/logout`, { method: 'POST' });
  } catch {}
  clearToken();
  window.location.hash = '';
  mostrarLogin('Has cerrado sesión correctamente.');
});

// Manejo general de cierre para modales ([data-cerrar] y clic exterior)
document.querySelectorAll('[data-cerrar]').forEach(btn => {
  btn.addEventListener('click', () => {
    const idModal = btn.dataset.cerrar;
    const modal = document.getElementById(idModal);
    if (modal) modal.classList.add('oculto');
  });
});

document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('oculto');
    }
  });
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activarTab(btn.dataset.tab, true);
  });
});

// ==========================================
// VENDEDORES / USUARIOS (VE-005, VE-006, VE-009)
// ==========================================
document.getElementById('reg-correo').addEventListener('input', (e) => {
  const aviso = document.getElementById('aviso-correo');
  const val = e.target.value.trim();
  if (val.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
    aviso.textContent = 'El correo debe tener un formato válido con dominio (ejemplo@correo.com)';
    aviso.classList.remove('oculto');
  } else {
    aviso.classList.add('oculto');
  }
});

document.getElementById('form-registro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const correo = document.getElementById('reg-correo').value.trim();
  const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!regexCorreo.test(correo)) {
    mostrarMensaje('msg-registro', 'El correo debe tener un formato válido (ejemplo@dominio.com).', 'error');
    document.getElementById('aviso-correo').classList.remove('oculto');
    return;
  }
  const body = {
    nombre: document.getElementById('reg-nombre').value.trim(),
    correo,
    telefono: document.getElementById('reg-telefono').value.trim(),
    id_rol: document.getElementById('reg-rol').value,
    password: document.getElementById('reg-password').value
  };

  try {
    const res = await apiFetch(`${API}/auth/register`, { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje('msg-registro', 'Vendedor registrado. Ya puede iniciar sesión.', 'exito');
      e.target.reset();
      document.getElementById('aviso-correo').classList.add('oculto');
      cargarVendedores();
    } else {
      mostrarMensaje('msg-registro', data.error || 'Error al registrar vendedor.', 'error');
    }
  } catch (err) {
    mostrarMensaje('msg-registro', err.message, 'error');
  }
});

async function cargarRoles() {
  try {
    const res = await apiFetch(`${API}/catalogos/roles`);
    const data = await res.json();
    const select = document.getElementById('reg-rol');
    if (select) {
      select.innerHTML = data.map(r => `<option value="${r.id_rol}">${r.nombre}</option>`).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

// VE-009: Mostrar rol y estado en la tabla de usuarios registrados
async function cargarVendedores() {
  try {
    const res = await apiFetch(`${API}/catalogos/usuarios`);
    const data = await res.json();
    const usuarioActual = getUsuarioActual();
    const esAdmin = usuarioActual.rol === 'Administrador' || usuarioActual.id_rol === 1;

    const tbody = document.querySelector('#tabla-vendedores tbody');
    if (!tbody) return;

    tbody.innerHTML = data.map(u => `
      <tr>
        <td>${u.nombre}</td>
        <td>${u.correo}</td>
        <td><span class="badge ${u.rol === 'Administrador' ? 'badge-admin' : 'badge-vendedor'}">${u.rol}</span></td>
        <td><span class="badge ${u.estado === 'ACTIVO' ? 'badge-activo' : 'badge-inactivo'}">${u.estado}</span></td>
        <td>
          ${esAdmin ? `<button type="button" class="btn-accion" onclick="restablecerClaveUsuario(${u.id_usuario}, '${u.nombre.replace(/'/g, "\\'")}')">🔑 Clave</button>` : '-'}
        </td>
      </tr>`).join('') || '<tr><td colspan="5">Sin usuarios registrados</td></tr>';
  } catch (err) {
    console.error(err);
  }
}

window.restablecerClaveUsuario = async function(id_usuario, nombre) {
  const nueva = prompt(`Ingresa la nueva contraseña para "${nombre}" (mínimo 6 caracteres):`);
  if (!nueva) return;
  if (nueva.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres.');
    return;
  }
  try {
    const res = await apiFetch(`${API}/auth/restablecer`, {
      method: 'POST',
      body: JSON.stringify({ id_usuario, password: nueva })
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.mensaje || 'Contraseña restablecida correctamente.');
    } else {
      alert(data.error || 'No se pudo restablecer la contraseña.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// ==========================================
// CATEGORÍAS (PR-013)
// ==========================================
async function cargarCategorias() {
  try {
    const res = await apiFetch(`${API}/catalogos/categorias`);
    const data = await res.json();
    const opciones = data.map(c => `<option value="${c.id_categoria}">${c.nombre}</option>`).join('');
    const pCat = document.getElementById('p-categoria');
    const editCat = document.getElementById('edit-categoria');
    if (pCat) pCat.innerHTML = opciones;
    if (editCat) editCat.innerHTML = opciones;
  } catch (err) {
    console.error(err);
  }
}

// PR-013: Modal de nueva categoría
const btnModalNuevaCat = document.getElementById('btn-modal-nueva-categoria');
const modalNuevaCat = document.getElementById('modal-nueva-categoria');
const formNuevaCat = document.getElementById('form-nueva-categoria');
if (btnModalNuevaCat && modalNuevaCat) {
  btnModalNuevaCat.addEventListener('click', () => {
    modalNuevaCat.classList.remove('oculto');
    document.getElementById('cat-nombre').value = '';
    document.getElementById('msg-nueva-categoria').textContent = '';
  });
}
if (formNuevaCat) {
  formNuevaCat.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('cat-nombre').value.trim();
    try {
      const res = await apiFetch(`${API}/catalogos/categorias`, {
        method: 'POST',
        body: JSON.stringify({ nombre })
      });
      const data = await res.json();
      if (res.ok) {
        mostrarMensaje('msg-nueva-categoria', data.mensaje, 'exito');
        await cargarCategorias();
        if (data.id_categoria) {
          const selectCat = document.getElementById('p-categoria');
          if (selectCat) selectCat.value = data.id_categoria;
        }
        setTimeout(() => {
          modalNuevaCat.classList.add('oculto');
        }, 600);
      } else {
        mostrarMensaje('msg-nueva-categoria', data.error || 'Error al registrar categoría.', 'error');
      }
    } catch (err) {
      mostrarMensaje('msg-nueva-categoria', err.message, 'error');
    }
  });
}

// ==========================================
// PROVEEDORES (EN-010)
// ==========================================
async function cargarProveedores() {
  try {
    const res = await apiFetch(`${API}/catalogos/proveedores`);
    const data = await res.json();
    const select = document.getElementById('c-proveedor');
    if (select) {
      select.innerHTML =
        '<option value="">Seleccione proveedor</option>' +
        data.map(p => `<option value="${p.id_proveedor}">${p.nombre}</option>`).join('');
    }
    cargarProveedoresTabla(data);
  } catch (err) {
    console.error(err);
  }
}

function cargarProveedoresTabla(proveedores) {
  const tbody = document.querySelector('#tabla-proveedores tbody');
  if (!tbody) return;
  tbody.innerHTML = (proveedores || []).map(p => `
    <tr>
      <td>${p.nombre}</td>
      <td>${p.contacto || '-'}</td>
      <td>${p.telefono || '-'}</td>
      <td>${p.direccion || '-'}</td>
    </tr>`).join('') || '<tr><td colspan="4">Sin proveedores registrados</td></tr>';
}

// EN-010: Modal de nuevo proveedor rápido desde compras
const btnModalNuevoProv = document.getElementById('btn-modal-nuevo-proveedor');
const modalNuevoProv = document.getElementById('modal-nuevo-proveedor');
const formNuevoProv = document.getElementById('form-nuevo-proveedor');
if (btnModalNuevoProv && modalNuevoProv) {
  btnModalNuevoProv.addEventListener('click', () => {
    modalNuevoProv.classList.remove('oculto');
    document.getElementById('np-nombre').value = '';
    document.getElementById('np-contacto').value = '';
    document.getElementById('np-telefono').value = '';
    document.getElementById('np-direccion').value = '';
    document.getElementById('msg-nuevo-proveedor').textContent = '';
  });
}
if (formNuevoProv) {
  formNuevoProv.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      nombre: document.getElementById('np-nombre').value.trim(),
      contacto: document.getElementById('np-contacto').value.trim(),
      telefono: document.getElementById('np-telefono').value.trim(),
      direccion: document.getElementById('np-direccion').value.trim()
    };
    try {
      const res = await apiFetch(`${API}/catalogos/proveedores`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        mostrarMensaje('msg-nuevo-proveedor', data.mensaje, 'exito');
        await cargarProveedores();
        if (data.id_proveedor) {
          const selectProv = document.getElementById('c-proveedor');
          if (selectProv) selectProv.value = data.id_proveedor;
        }
        setTimeout(() => {
          modalNuevoProv.classList.add('oculto');
        }, 600);
      } else {
        mostrarMensaje('msg-nuevo-proveedor', data.error || 'Error al registrar proveedor.', 'error');
      }
    } catch (err) {
      mostrarMensaje('msg-nuevo-proveedor', err.message, 'error');
    }
  });
}

// Formulario de proveedor en la pestaña de proveedores
const formProveedorTab = document.getElementById('form-proveedor-tab');
if (formProveedorTab) {
  formProveedorTab.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      nombre: document.getElementById('prov-nombre').value.trim(),
      contacto: document.getElementById('prov-contacto').value.trim(),
      telefono: document.getElementById('prov-telefono').value.trim(),
      direccion: document.getElementById('prov-direccion').value.trim()
    };
    try {
      const res = await apiFetch(`${API}/catalogos/proveedores`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        mostrarMensaje('msg-proveedor-tab', data.mensaje, 'exito');
        formProveedorTab.reset();
        cargarProveedores();
      } else {
        mostrarMensaje('msg-proveedor-tab', data.error || 'Error al guardar.', 'error');
      }
    } catch (err) {
      mostrarMensaje('msg-proveedor-tab', err.message, 'error');
    }
  });
}

// EN-008: Compatibilidad de usuarios (los movimientos se asocian al usuario autenticado por JWT)
async function cargarUsuarios() {
  // Los responsables de Entrada y Salida se toman directamente del JWT en el backend
}

// ==========================================
// PRODUCTOS (PR-004, PR-008, PR-014, PR-015, PR-016, PR-017, SA-008)
// ==========================================
let listaProductosCache = [];

function actualizarInfoCompra() {
  const selectProd = document.getElementById('c-producto');
  const inputCosto = document.getElementById('c-costo');
  const infoEl = document.getElementById('info-costo-compra');
  if (!infoEl || !selectProd || !inputCosto) return;

  const idProd = selectProd.value;
  if (!idProd) {
    infoEl.classList.add('oculto');
    inputCosto.classList.remove('campo-invalido');
    return;
  }

  const prod = listaProductosCache.find(p => String(p.id_producto) === String(idProd));
  if (!prod) return;

  const precioVenta = parseFloat(prod.precio) || 0;
  const costo = parseFloat(inputCosto.value);
  let html = `<span>Precio de venta al público en catálogo: <strong>$${precioVenta.toFixed(2)}</strong></span>`;

  if (!isNaN(costo) && costo > 0) {
    if (costo >= precioVenta) {
      inputCosto.classList.add('campo-invalido');
      html += `<br><span class="ganancia-negativa">⚠️ El costo de compra ($${costo.toFixed(2)}) no puede ser mayor o igual al precio de venta ($${precioVenta.toFixed(2)}). Tendrías pérdidas.</span>`;
    } else {
      inputCosto.classList.remove('campo-invalido');
      const ganancia = precioVenta - costo;
      const margenPct = ((ganancia / costo) * 100).toFixed(1);
      html += `<br><span class="ganancia-positiva">✅ Margen proyectado: $${ganancia.toFixed(2)} (${margenPct}%) por unidad</span>`;
    }
  } else {
    inputCosto.classList.remove('campo-invalido');
  }

  infoEl.innerHTML = html;
  infoEl.classList.remove('oculto');
}

function actualizarInfoVenta(autollenar = false) {
  const selectProd = document.getElementById('v-producto');
  const inputPrecio = document.getElementById('v-precio');
  const selectConcepto = document.getElementById('v-concepto');
  const infoEl = document.getElementById('info-precio-venta');
  if (!infoEl || !selectProd || !inputPrecio) return;

  const idProd = selectProd.value;
  if (!idProd) {
    infoEl.classList.add('oculto');
    inputPrecio.classList.remove('campo-invalido');
    return;
  }

  const prod = listaProductosCache.find(p => String(p.id_producto) === String(idProd));
  if (!prod) return;

  if (autollenar && prod.precio) {
    inputPrecio.value = prod.precio;
  }

  const concepto = selectConcepto ? selectConcepto.value : 'VENTA';
  if (concepto !== 'VENTA') {
    inputPrecio.classList.remove('campo-invalido');
    infoEl.innerHTML = `<span>Salida por <strong>${concepto}</strong>: no comercial, no requiere margen de ganancia.</span>`;
    infoEl.classList.remove('oculto');
    return;
  }

  const precioVenta = parseFloat(inputPrecio.value);
  const costoRef = (prod.ultimo_costo !== null && prod.ultimo_costo !== undefined) ? parseFloat(prod.ultimo_costo) : null;

  let html = `<span>Precio base sugerido: <strong>$${Number(prod.precio).toFixed(2)}</strong></span>`;
  if (costoRef !== null) {
    html += ` | <span>Costo compra del lote/proveedor: <strong>$${costoRef.toFixed(2)}</strong></span>`;
  }

  if (!isNaN(precioVenta)) {
    if (precioVenta <= 0) {
      inputPrecio.classList.add('campo-invalido');
      html += `<br><span class="ganancia-negativa">⚠️ El precio de venta debe ser mayor a cero.</span>`;
    } else if (costoRef !== null && precioVenta <= costoRef) {
      inputPrecio.classList.add('campo-invalido');
      html += `<br><span class="ganancia-negativa">⚠️ El precio ($${precioVenta.toFixed(2)}) es menor o igual al costo ($${costoRef.toFixed(2)}). Debes venderlo a mayor precio para obtener ganancia.</span>`;
    } else if (costoRef !== null) {
      inputPrecio.classList.remove('campo-invalido');
      const ganancia = precioVenta - costoRef;
      const margenPct = ((ganancia / costoRef) * 100).toFixed(1);
      html += `<br><span class="ganancia-positiva">✅ Ganancia estimada: $${ganancia.toFixed(2)} (${margenPct}%) por unidad vendida</span>`;
    } else {
      inputPrecio.classList.remove('campo-invalido');
    }
  } else {
    inputPrecio.classList.remove('campo-invalido');
  }

  infoEl.innerHTML = html;
  infoEl.classList.remove('oculto');
}

// SA-008: Solo cargar productos ACTIVOS para los selectores de Entradas y Salidas
async function cargarProductosSelects() {
  try {
    const res = await apiFetch(`${API}/productos?solo_activos=1`);
    listaProductosCache = await res.json();
    const opciones = '<option value="">Seleccione producto</option>' +
      listaProductosCache.map(p => `<option value="${p.id_producto}">${p.nombre} (${p.sku})</option>`).join('');

    const cProd = document.getElementById('c-producto');
    const vProd = document.getElementById('v-producto');
    if (cProd) cProd.innerHTML = opciones;
    if (vProd) vProd.innerHTML = opciones;

    actualizarInfoCompra();
    actualizarInfoVenta(false);
  } catch (err) {
    console.error(err);
  }
}

const cProdEl = document.getElementById('c-producto');
if (cProdEl) cProdEl.addEventListener('change', actualizarInfoCompra);
const cCostoEl = document.getElementById('c-costo');
if (cCostoEl) cCostoEl.addEventListener('input', actualizarInfoCompra);

const vProdEl = document.getElementById('v-producto');
if (vProdEl) vProdEl.addEventListener('change', () => actualizarInfoVenta(true));
const vPrecioEl = document.getElementById('v-precio');
if (vPrecioEl) vPrecioEl.addEventListener('input', () => actualizarInfoVenta(false));
const vConceptoEl = document.getElementById('v-concepto');
if (vConceptoEl) vConceptoEl.addEventListener('change', () => actualizarInfoVenta(false));

async function cargarProductos(filtro) {
  try {
    const url = filtro ? `${API}/productos?buscar=${encodeURIComponent(filtro)}` : `${API}/productos`;
    const res = await apiFetch(url);
    const data = await res.json();

    if (!filtro) {
      listaProductosCache = data;
    } else {
      data.forEach(item => {
        const idx = listaProductosCache.findIndex(p => p.id_producto === item.id_producto);
        if (idx >= 0) listaProductosCache[idx] = item;
        else listaProductosCache.push(item);
      });
    }

    const tbody = document.querySelector('#tabla-productos tbody');
    if (!tbody) return;

    tbody.innerHTML = data.map(p => `
      <tr class="${p.estado === 'INACTIVO' ? 'inactivo' : ''}">
        <td>${p.sku}</td><td>${p.nombre}</td><td>${p.marca || '-'}</td>
        <td>${p.categoria}</td><td>$${Number(p.precio).toFixed(2)}</td>
        <td>${p.stock_actual}</td><td>${p.stock_minimo}</td>
        <td>
          <button type="button" class="btn-accion btn-editar" onclick="abrirModalEditarProducto(${p.id_producto})">✏️ Editar</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="8">Sin resultados</td></tr>';
  } catch (err) {
    console.error(err);
  }
}

window.abrirModalEditarProducto = async function(id_producto) {
  let prod = listaProductosCache.find(p => String(p.id_producto) === String(id_producto));
  if (!prod) {
    try {
      const res = await apiFetch(`${API}/productos`);
      listaProductosCache = await res.json();
      prod = listaProductosCache.find(p => String(p.id_producto) === String(id_producto));
    } catch (err) {
      console.error(err);
    }
  }

  if (!prod) {
    alert('No se pudo encontrar la información del producto.');
    return;
  }

  const selectCat = document.getElementById('edit-categoria');
  if (selectCat && !selectCat.children.length) {
    await cargarCategorias();
  }

  document.getElementById('edit-id-producto').value = prod.id_producto;
  document.getElementById('edit-sku').value = prod.sku;
  document.getElementById('edit-nombre').value = prod.nombre;
  document.getElementById('edit-marca').value = prod.marca || '';
  document.getElementById('edit-categoria').value = prod.id_categoria;
  document.getElementById('edit-precio').value = prod.precio;
  document.getElementById('edit-stockmin').value = prod.stock_minimo;
  document.getElementById('edit-estado').value = prod.estado || 'ACTIVO';
  document.getElementById('msg-editar-producto').textContent = '';

  document.getElementById('modal-editar-producto').classList.remove('oculto');
};

function cerrarModalEditarProducto() {
  document.getElementById('modal-editar-producto').classList.add('oculto');
}

const btnCerrarModal = document.getElementById('btn-cerrar-modal');
if (btnCerrarModal) btnCerrarModal.addEventListener('click', cerrarModalEditarProducto);

const btnCancelarModal = document.getElementById('btn-cancelar-modal');
if (btnCancelarModal) btnCancelarModal.addEventListener('click', cerrarModalEditarProducto);

document.getElementById('form-editar-producto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id-producto').value;
  const body = {
    nombre: document.getElementById('edit-nombre').value.trim(),
    marca: document.getElementById('edit-marca').value.trim(),
    id_categoria: document.getElementById('edit-categoria').value,
    precio: parseFloat(document.getElementById('edit-precio').value),
    stock_minimo: parseInt(document.getElementById('edit-stockmin').value) || 0,
    estado: document.getElementById('edit-estado').value
  };

  try {
    const res = await apiFetch(`${API}/productos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      cerrarModalEditarProducto();
      mostrarMensaje('msg-producto', data.mensaje, 'exito');
      cargarProductos();
      cargarProductosSelects();
    } else {
      mostrarMensaje('msg-editar-producto', data.error || 'Error al actualizar producto.', 'error');
    }
  } catch (err) {
    mostrarMensaje('msg-editar-producto', err.message, 'error');
  }
});

const buscarProductoInput = document.getElementById('buscar-producto');
if (buscarProductoInput) {
  buscarProductoInput.addEventListener('input', (e) => {
    cargarProductos(e.target.value);
  });
}

document.getElementById('form-producto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    sku: document.getElementById('p-sku').value.trim(),
    nombre: document.getElementById('p-nombre').value.trim(),
    marca: document.getElementById('p-marca').value.trim(),
    precio: parseFloat(document.getElementById('p-precio').value),
    id_categoria: document.getElementById('p-categoria').value,
    stock_minimo: parseInt(document.getElementById('p-stockmin').value) || 0
  };
  try {
    const res = await apiFetch(`${API}/productos`, { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje('msg-producto', data.mensaje, 'exito');
      e.target.reset();
      cargarProductos();
      cargarProductosSelects();
    } else {
      mostrarMensaje('msg-producto', data.error || 'Error al registrar producto.', 'error');
    }
  } catch (err) {
    mostrarMensaje('msg-producto', err.message, 'error');
  }
});

// ==========================================
// ENTRADAS / COMPRAS (EN-008, EN-009, EN-010)
// ==========================================
async function cargarCompras() {
  try {
    const res = await apiFetch(`${API}/compras`);
    const data = await res.json();
    const tbody = document.querySelector('#tabla-compras tbody');
    if (!tbody) return;

    tbody.innerHTML = data.map(c => `
      <tr>
        <td>${c.producto} (${c.sku})</td><td>${c.proveedor}</td><td>${c.cantidad}</td>
        <td>${c.cantidad_disponible}</td><td>$${Number(c.costo_unitario).toFixed(2)}</td>
        <td>${new Date(c.fecha_vencimiento).toLocaleDateString()}</td>
        <td>${new Date(c.fecha_compra).toLocaleDateString()}</td>
      </tr>`).join('') || '<tr><td colspan="7">Sin registros</td></tr>';
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('form-compra').addEventListener('submit', async (e) => {
  e.preventDefault();
  const idProducto = document.getElementById('c-producto').value;
  const costoUnitario = parseFloat(document.getElementById('c-costo').value);

  const prod = listaProductosCache.find(p => String(p.id_producto) === String(idProducto));
  if (prod && costoUnitario >= parseFloat(prod.precio)) {
    mostrarMensaje('msg-compra', `El costo de compra ($${costoUnitario.toFixed(2)}) no puede ser mayor o igual al precio de venta del catálogo ($${Number(prod.precio).toFixed(2)}).`, 'error');
    return;
  }

  // EN-009: id_usuario se toma en el servidor a partir del token JWT
  const body = {
    id_proveedor: document.getElementById('c-proveedor').value,
    items: [{
      id_producto: idProducto,
      cantidad: parseInt(document.getElementById('c-cantidad').value),
      costo_unitario: costoUnitario,
      fecha_vencimiento: document.getElementById('c-vencimiento').value
    }]
  };

  try {
    const res = await apiFetch(`${API}/compras`, { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje('msg-compra', data.mensaje, 'exito');
      e.target.reset();
      document.getElementById('info-costo-compra').classList.add('oculto');
      document.getElementById('c-costo').classList.remove('campo-invalido');
      ajustarFechaMinima();
      cargarCompras();
      cargarProductos();
      cargarProductosSelects();
    } else {
      mostrarMensaje('msg-compra', data.error || 'Error al registrar la entrada.', 'error');
    }
  } catch (err) {
    mostrarMensaje('msg-compra', err.message, 'error');
  }
});

function ajustarFechaMinima() {
  const inputVenc = document.getElementById('c-vencimiento');
  if (!inputVenc) return;
  const hoy = new Date().toISOString().split('T')[0];
  inputVenc.setAttribute('min', hoy);
}

// ==========================================
// SALIDAS / VENTAS (SA-007, SA-008, SA-010, SA-012)
// ==========================================
let carritoVenta = [];

function renderCarritoVenta() {
  const tbody = document.querySelector('#tabla-carrito-venta tbody');
  if (!tbody) return;

  if (carritoVenta.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888;">No hay productos agregados a esta venta</td></tr>';
    return;
  }

  let totalVenta = 0;
  tbody.innerHTML = carritoVenta.map((item, idx) => {
    const subtotal = item.concepto === 'VENTA' ? (item.cantidad * item.precio_unitario) : 0;
    totalVenta += subtotal;
    return `
      <tr>
        <td>${item.nombre} (${item.sku})</td>
        <td>${item.cantidad}</td>
        <td>${item.concepto}</td>
        <td>${item.concepto === 'VENTA' ? `$${item.precio_unitario.toFixed(2)} (Sub: $${subtotal.toFixed(2)})` : '$0.00'}</td>
        <td>
          <button type="button" class="btn-quitar-item" onclick="quitarItemCarrito(${idx})" title="Quitar">✕</button>
        </td>
      </tr>
    `;
  }).join('') + `
    <tr class="fila-total-carrito">
      <td colspan="3" style="text-align:right;"><strong>Total estimado:</strong></td>
      <td colspan="2"><strong>$${totalVenta.toFixed(2)}</strong></td>
    </tr>
  `;
}

window.quitarItemCarrito = function(index) {
  carritoVenta.splice(index, 1);
  renderCarritoVenta();
};

function validarYObtenerItemVentaFormulario() {
  const idProducto = document.getElementById('v-producto').value;
  const cantidad = parseInt(document.getElementById('v-cantidad').value);
  const precioUnitario = parseFloat(document.getElementById('v-precio').value) || 0;
  const concepto = document.getElementById('v-concepto').value || 'VENTA';

  if (!idProducto) {
    mostrarMensaje('msg-venta', 'Selecciona un producto.', 'error');
    return null;
  }
  if (!cantidad || cantidad <= 0) {
    mostrarMensaje('msg-venta', 'La cantidad debe ser mayor a cero.', 'error');
    return null;
  }

  const prod = listaProductosCache.find(p => String(p.id_producto) === String(idProducto));
  if (!prod) {
    mostrarMensaje('msg-venta', 'Producto no válido.', 'error');
    return null;
  }

  if (concepto === 'VENTA') {
    if (precioUnitario <= 0) {
      mostrarMensaje('msg-venta', 'El precio unitario de venta debe ser un número mayor a cero.', 'error');
      return null;
    }
    if (prod.ultimo_costo !== null && prod.ultimo_costo !== undefined && precioUnitario <= parseFloat(prod.ultimo_costo)) {
      mostrarMensaje('msg-venta', `El precio de venta ($${precioUnitario.toFixed(2)}) debe ser mayor al costo de adquisición ($${Number(prod.ultimo_costo).toFixed(2)}) para obtener ganancia.`, 'error');
      return null;
    }
  }

  return {
    id_producto: parseInt(idProducto),
    nombre: prod.nombre,
    sku: prod.sku,
    cantidad: cantidad,
    precio_unitario: precioUnitario,
    concepto: concepto
  };
}

// SA-012: Botón "+ Agregar producto" para venta multi-producto
const btnAgregarVenta = document.getElementById('btn-agregar-venta');
if (btnAgregarVenta) {
  btnAgregarVenta.addEventListener('click', () => {
    const item = validarYObtenerItemVentaFormulario();
    if (!item) return;

    const existente = carritoVenta.find(it => it.id_producto === item.id_producto && it.concepto === item.concepto);
    if (existente) {
      existente.cantidad += item.cantidad;
      existente.precio_unitario = item.precio_unitario;
    } else {
      carritoVenta.push(item);
    }

    renderCarritoVenta();
    mostrarMensaje('msg-venta', `"${item.nombre}" agregado a la lista.`, 'exito');
    document.getElementById('v-cantidad').value = '';
    document.getElementById('v-precio').value = '';
    document.getElementById('info-precio-venta').classList.add('oculto');
    document.getElementById('v-precio').classList.remove('campo-invalido');
  });
}

// SA-010 / SA-012: Registrar salida
document.getElementById('form-venta').addEventListener('submit', async (e) => {
  e.preventDefault();

  let itemsAEnviar = [...carritoVenta];
  if (itemsAEnviar.length === 0) {
    const itemUnico = validarYObtenerItemVentaFormulario();
    if (!itemUnico) {
      mostrarMensaje('msg-venta', 'Agrega al menos un producto a la venta.', 'error');
      return;
    }
    itemsAEnviar = [itemUnico];
  }

  // SA-010: id_usuario se toma en el servidor a partir del token JWT
  const body = {
    id_cliente: document.getElementById('v-cliente').value || null,
    items: itemsAEnviar.map(it => ({
      id_producto: it.id_producto,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      concepto: it.concepto
    }))
  };

  try {
    const res = await apiFetch(`${API}/ventas`, { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje('msg-venta', data.mensaje || 'Salida registrada correctamente.', 'exito');
      carritoVenta = [];
      renderCarritoVenta();
      e.target.reset();
      document.getElementById('info-precio-venta').classList.add('oculto');
      document.getElementById('v-precio').classList.remove('campo-invalido');
      cargarVentas();
      cargarProductos();
      cargarProductosSelects();
    } else {
      mostrarMensaje('msg-venta', data.error || 'Error al registrar la salida.', 'error');
    }
  } catch (err) {
    mostrarMensaje('msg-venta', err.message || 'Error de conexión.', 'error');
  }
});

async function cargarVentas() {
  try {
    const res = await apiFetch(`${API}/ventas`);
    const data = await res.json();
    const tbody = document.querySelector('#tabla-ventas tbody');
    if (!tbody) return;

    tbody.innerHTML = data.map(v => `
      <tr>
        <td>${v.producto}</td>
        <td>${v.cliente || 'Cliente General'}</td>
        <td>${v.cantidad}</td>
        <td>${v.concepto}</td>
        <td>$${Number(v.precio_unitario).toFixed(2)}</td>
        <td>${v.usuario}</td>
        <td>${new Date(v.fecha_venta).toLocaleDateString()}</td>
      </tr>`).join('') || '<tr><td colspan="7">Sin registros</td></tr>';
  } catch (err) {
    console.error(err);
  }
}

// ==========================================
// CLIENTES (CL-007, CL-008, CL-009, CL-010)
// ==========================================
async function cargarClientesSelect() {
  try {
    const res = await apiFetch(`${API}/clientes`);
    const data = await res.json();
    const select = document.getElementById('v-cliente');
    if (!select) return;
    select.innerHTML = '<option value="">Cliente General / Ocasional</option>' +
      data.map(c => `<option value="${c.id_cliente}">${c.nombre} (${c.documento_identidad})</option>`).join('');
  } catch (err) {
    console.error(err);
  }
}

// CL-010: Listado con botón de edición
async function cargarClientes(filtro) {
  try {
    const url = filtro ? `${API}/clientes?buscar=${encodeURIComponent(filtro)}` : `${API}/clientes`;
    const res = await apiFetch(url);
    const data = await res.json();
    const tbody = document.querySelector('#tabla-clientes tbody');
    if (!tbody) return;

    tbody.innerHTML = data.map(c => `
      <tr>
        <td>${c.documento_identidad}</td>
        <td>${c.nombre}</td>
        <td>${c.contacto || '-'}</td>
        <td>${new Date(c.fecha_registro).toLocaleDateString()}</td>
        <td>
          <button type="button" class="btn-accion btn-editar" onclick="abrirModalEditarCliente(${c.id_cliente}, '${c.documento_identidad}', '${(c.nombre || '').replace(/'/g, "\\'")}', '${(c.contacto || '').replace(/'/g, "\\'")}')">✏️ Editar</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="5">Sin clientes registrados</td></tr>';
  } catch (err) {
    console.error(err);
  }
}

// CL-010: Modal y actualización de cliente
window.abrirModalEditarCliente = function(id, documento, nombre, contacto) {
  document.getElementById('edit-id-cliente').value = id;
  document.getElementById('edit-cli-documento').value = documento;
  document.getElementById('edit-cli-nombre').value = nombre;
  document.getElementById('edit-cli-contacto').value = contacto || '';
  document.getElementById('msg-editar-cliente').textContent = '';
  document.getElementById('modal-editar-cliente').classList.remove('oculto');
};

const formEditarCliente = document.getElementById('form-editar-cliente');
if (formEditarCliente) {
  formEditarCliente.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id-cliente').value;
    const body = {
      nombre: document.getElementById('edit-cli-nombre').value.trim(),
      contacto: document.getElementById('edit-cli-contacto').value.trim()
    };
    try {
      const res = await apiFetch(`${API}/clientes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        document.getElementById('modal-editar-cliente').classList.add('oculto');
        mostrarMensaje('msg-cliente', data.mensaje, 'exito');
        cargarClientes();
        cargarClientesSelect();
      } else {
        mostrarMensaje('msg-editar-cliente', data.error || 'Error al actualizar cliente.', 'error');
      }
    } catch (err) {
      mostrarMensaje('msg-editar-cliente', err.message, 'error');
    }
  });
}

const buscarClienteInput = document.getElementById('buscar-cliente');
if (buscarClienteInput) {
  buscarClienteInput.addEventListener('input', (e) => {
    cargarClientes(e.target.value);
  });
}

document.getElementById('form-cliente').addEventListener('submit', async (e) => {
  e.preventDefault();
  const doc = document.getElementById('cli-documento').value.trim();
  const nom = document.getElementById('cli-nombre').value.trim();
  const cont = document.getElementById('cli-contacto').value.trim();

  if (!doc || !nom) {
    mostrarMensaje('msg-cliente', 'Documento y nombre son obligatorios.', 'error');
    return;
  }

  try {
    const res = await apiFetch(`${API}/clientes`, {
      method: 'POST',
      body: JSON.stringify({
        documento_identidad: doc,
        nombre: nom,
        contacto: cont
      })
    });
    const data = await res.json();
    if (res.ok) {
      mostrarMensaje('msg-cliente', data.mensaje, 'exito');
      e.target.reset();
      cargarClientes();
      cargarClientesSelect();
    } else {
      mostrarMensaje('msg-cliente', data.error || 'Error al registrar cliente.', 'error');
    }
  } catch (err) {
    mostrarMensaje('msg-cliente', err.message || 'Error al conectar con el servidor.', 'error');
  }
});

// ==========================================
// ALERTAS Y STOCK CRÍTICO (AL-004)
// ==========================================
// AL-004: Mostrar texto claro para productos vencidos en lugar de números negativos
function textoDiasCaducidad(item) {
  if (item.dias_texto) return item.dias_texto;
  const n = parseInt(item.dias_restantes, 10);
  if (isNaN(n)) return '';
  if (n < 0) return `Vencido hace ${Math.abs(n)} día(s)`;
  if (n === 0) return 'Vence hoy';
  return `${n} día(s)`;
}

async function cargarAlertas() {
  try {
    const res = await apiFetch(`${API}/alertas/caducidad?dias=30`);
    const data = await res.json();
    const tbody = document.querySelector('#tabla-alertas tbody');
    if (!tbody) return;

    tbody.innerHTML = data.map(a => `
      <tr class="${a.estado.toLowerCase() === 'vencido' ? 'vencido' : 'urgente'}">
        <td>${a.producto}</td><td>${a.sku}</td><td>${a.cantidad_disponible}</td>
        <td>${new Date(a.fecha_vencimiento).toLocaleDateString()}</td>
        <td><strong>${textoDiasCaducidad(a)}</strong></td><td>${a.estado}</td>
      </tr>`).join('') || '<tr><td colspan="6">No hay alertas activas</td></tr>';
  } catch (err) {
    console.error(err);
  }
}

async function cargarCritico() {
  try {
    const res = await apiFetch(`${API}/productos/stock-critico`);
    const data = await res.json();
    const tbody = document.querySelector('#tabla-critico tbody');
    if (!tbody) return;

    tbody.innerHTML = data.map(p => `
      <tr class="critico">
        <td>${p.sku}</td><td>${p.nombre}</td><td>${p.stock_actual}</td><td>${p.stock_minimo}</td>
      </tr>`).join('') || '<tr><td colspan="4">Inventario estable, sin faltantes</td></tr>';
  } catch (err) {
    console.error(err);
  }
}

// ==========================================
// REPORTES (AL-004, RE-001..RE-006)
// ==========================================
async function descargarPdf(url, nombreArchivo) {
  const res = await apiFetch(url);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Error al generar el PDF.');
  }
  const blob = await res.blob();
  const urlBlob = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = urlBlob;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(urlBlob);
}

document.getElementById('btn-generar-caducidad').addEventListener('click', async () => {
  const tabla = document.getElementById('tabla-reporte-caducidad');
  const btnDescargar = document.getElementById('btn-descargar-caducidad');
  try {
    const res = await apiFetch(`${API}/reportes/caducidad?dias=60`);
    if (res.status === 404 || res.status === 400) {
      const data = await res.json();
      mostrarMensaje('msg-reporte-caducidad', data.error, 'error');
      tabla.classList.add('oculto');
      btnDescargar.classList.add('oculto');
      return;
    }
    const data = await res.json();
    document.querySelector('#tabla-reporte-caducidad tbody').innerHTML = data.map(a => `
      <tr class="${a.estado.toLowerCase() === 'vencido' ? 'vencido' : 'urgente'}">
        <td>${a.producto}</td><td>${a.sku}</td><td>${a.cantidad_disponible}</td>
        <td>${new Date(a.fecha_vencimiento).toLocaleDateString()}</td>
        <td><strong>${textoDiasCaducidad(a)}</strong></td><td>${a.estado}</td>
      </tr>`).join('');
    tabla.classList.remove('oculto');
    btnDescargar.classList.remove('oculto');
    mostrarMensaje('msg-reporte-caducidad', `Reporte generado: ${data.length} lote(s) encontrados.`, 'exito');
  } catch (err) {
    mostrarMensaje('msg-reporte-caducidad', err.message, 'error');
  }
});

document.getElementById('btn-descargar-caducidad').addEventListener('click', async () => {
  try {
    await descargarPdf(`${API}/reportes/caducidad?dias=60&formato=pdf`, `reporte_caducidad_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    mostrarMensaje('msg-reporte-caducidad', err.message, 'error');
  }
});

document.getElementById('btn-generar-movimientos').addEventListener('click', async () => {
  const desde = document.getElementById('rep-desde').value;
  const hasta = document.getElementById('rep-hasta').value;
  const tabla = document.getElementById('tabla-reporte-movimientos');
  const btnDescargar = document.getElementById('btn-descargar-movimientos');

  if (!desde || !hasta) {
    mostrarMensaje('msg-reporte-movimientos', 'Selecciona la fecha de inicio y de fin.', 'error');
    return;
  }

  try {
    const res = await apiFetch(`${API}/reportes/movimientos?desde=${desde}&hasta=${hasta}`);
    if (res.status === 404 || res.status === 400) {
      const data = await res.json();
      mostrarMensaje('msg-reporte-movimientos', data.error, 'error');
      tabla.classList.add('oculto');
      btnDescargar.classList.add('oculto');
      return;
    }
    const data = await res.json();
    document.querySelector('#tabla-reporte-movimientos tbody').innerHTML = data.map(m => `
      <tr>
        <td>${m.tipo}</td><td>${new Date(m.fecha).toLocaleString()}</td><td>${m.producto}</td>
        <td>${m.cantidad}</td><td>${m.usuario}</td><td>${m.detalle}</td>
      </tr>`).join('');
    tabla.classList.remove('oculto');
    btnDescargar.classList.remove('oculto');
    mostrarMensaje('msg-reporte-movimientos', `Reporte generado: ${data.length} movimiento(s) encontrados.`, 'exito');
  } catch (err) {
    mostrarMensaje('msg-reporte-movimientos', err.message, 'error');
  }
});

document.getElementById('btn-descargar-movimientos').addEventListener('click', async () => {
  const desde = document.getElementById('rep-desde').value;
  const hasta = document.getElementById('rep-hasta').value;
  try {
    await descargarPdf(`${API}/reportes/movimientos?desde=${desde}&hasta=${hasta}&formato=pdf`, `reporte_movimientos_${desde}_a_${hasta}.pdf`);
  } catch (err) {
    mostrarMensaje('msg-reporte-movimientos', err.message, 'error');
  }
});

// ==========================================
// CICLO DE VIDA Y RUTEO
// ==========================================
function cargarSeccion(tab) {
  if (tab === 'productos') {
    cargarCategorias();
    cargarProductos();
  }
  if (tab === 'compras') {
    cargarProveedores();
    cargarProductosSelects();
    cargarCompras();
  }
  if (tab === 'ventas') {
    cargarClientesSelect();
    cargarProductosSelects();
    renderCarritoVenta();
    cargarVentas();
  }
  if (tab === 'clientes') {
    cargarClientes();
  }
  if (tab === 'proveedores') {
    cargarProveedores();
  }
  if (tab === 'alertas') {
    cargarAlertas();
  }
  if (tab === 'critico') {
    cargarCritico();
  }
  if (tab === 'vendedores') {
    cargarRoles();
    cargarVendedores();
  }
}

function inicializarApp() {
  ajustarFechaMinima();
  cargarCategorias();
  cargarProductosSelects();
  cargarProductos();
}

window.addEventListener('hashchange', () => {
  if (!getToken()) {
    mostrarLogin();
    return;
  }
  const appVisible = !document.getElementById('app').classList.contains('oculto');
  if (appVisible) {
    const tab = obtenerTabDeHash();
    activarTab(tab, false);
  }
});

window.addEventListener('storage', (e) => {
  if (e.key === 'token') {
    if (!e.newValue) {
      mostrarLogin('La sesión fue cerrada desde otra pestaña.');
    } else {
      verificarSesion();
    }
  }
});

window.addEventListener('pageshow', verificarSesion);
verificarSesion();
