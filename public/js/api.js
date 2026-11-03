/**
 * Cliente HTTP del frontend. Centraliza fetch, el manejo de errores y el
 * formato JSON para que las vistas no repitan código.
 */
export class ErrorApi extends Error {
  constructor(status, mensaje, errores) {
    super(mensaje);
    this.status = status;
    this.errores = errores || null;
  }
}

async function solicitar(metodo, ruta, cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, 'No hay conexión con el servidor. Verifica que esté encendido (npm start).');
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, datos.error || 'La operación no se pudo completar.', datos.errores);
  }
  return datos;
}

export const api = {
  listar: (recurso, parametros = {}) => {
    const query = new URLSearchParams(
      Object.entries(parametros).filter(([, v]) => v !== '' && v !== undefined && v !== null)
    ).toString();
    return solicitar('GET', `/api/${recurso}${query ? `?${query}` : ''}`);
  },
  obtener: (recurso, id) => solicitar('GET', `/api/${recurso}/${id}`),
  crear: (recurso, datos) => solicitar('POST', `/api/${recurso}`, datos),
  actualizar: (recurso, id, datos) => solicitar('PUT', `/api/${recurso}/${id}`, datos),
  eliminar: (recurso, id) => solicitar('DELETE', `/api/${recurso}/${id}`),
  anularVenta: (id) => solicitar('POST', `/api/ventas/${id}/anular`),
  resumen: () => solicitar('GET', '/api/resumen'),
};
