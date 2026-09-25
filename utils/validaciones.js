const PRECIO_MINIMO = 100;
const PRECIO_MAXIMO = 99999999.99;

const PATRON_SKU = /^[A-Za-z]{2,8}-[A-Za-z0-9]{1,20}$/;
const PATRON_NOMBRE_PERSONA = /^[A-Za-zÁÉÍÓÚáéíóúÜüÑñ\s]{2,150}$/;
const PATRON_PRODUCTO = /^(?=.*[A-Za-zÁÉÍÓÚáéíóúÜüÑñ])[A-Za-zÁÉÍÓÚáéíóúÜüÑñ0-9\s.'-]{2,150}$/;
const PATRON_DOCUMENTO = /^[0-9]{8,10}$/;
const PATRON_TELEFONO = /^[0-9]{7,10}$/;
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function esVacio(valor) {
  return valor === undefined || valor === null || String(valor).trim() === '';
}

function validarPrecio(precio) {
  const n = Number(precio);
  if (esVacio(precio) || Number.isNaN(n)) {
    return 'El precio debe ser un número mayor a cero.';
  }
  if (n <= 0) {
    return 'El precio debe ser un número mayor a cero.';
  }
  if (n < PRECIO_MINIMO) {
    return `El precio mínimo permitido es $${PRECIO_MINIMO}.`;
  }
  if (n > PRECIO_MAXIMO) {
    return `El precio máximo permitido es $${PRECIO_MAXIMO.toLocaleString('es-CO')}.`;
  }
  return null;
}

function textoDiasRestantes(dias) {
  const n = parseInt(dias, 10);
  if (Number.isNaN(n)) return '';
  if (n < 0) return `Vencido hace ${Math.abs(n)} día(s)`;
  if (n === 0) return 'Vence hoy';
  return `${n} día(s)`;
}

function enriquecerCaducidad(filas) {
  return filas.map((fila) => ({
    ...fila,
    dias_texto: textoDiasRestantes(fila.dias_restantes)
  }));
}

module.exports = {
  PRECIO_MINIMO,
  PRECIO_MAXIMO,
  PATRON_SKU,
  PATRON_NOMBRE_PERSONA,
  PATRON_PRODUCTO,
  PATRON_DOCUMENTO,
  PATRON_TELEFONO,
  PATRON_CORREO,
  esVacio,
  validarPrecio,
  textoDiasRestantes,
  enriquecerCaducidad
};
