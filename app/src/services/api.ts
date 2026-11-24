import { ErrorApi } from './errores';
import { obtenerToken, olvidarSesion } from '@/composables/useAuth';
import router from '@/router';

const BASE_URL = import.meta.env.VITE_API_URL;
const TIEMPO_MAXIMO_MS = 10_000;

export interface OpcionesApi {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

/**
 * Cliente HTTP único de la aplicación (M1).
 */
export async function api<T = unknown>(ruta: string, opciones: OpcionesApi = {}): Promise<T> {
  const { method = 'GET', body, params } = opciones;

  // 1. Construir URL y filtrar parámetros con valor válido (ni undefined ni '')
  const url = new URL(`${BASE_URL}${ruta}`);
  if (params) {
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== undefined && valor !== '') {
        url.searchParams.append(clave, String(valor));
      }
    }
  }

  // 2, 3 y 4. Encabezados (Accept, Bearer si hay token, Content-Type si hay body)
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const token = obtenerToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  // 5. Control de tiempo máximo con AbortController (10 s)
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controlador.signal,
    });
  } catch {
    throw new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' });
  } finally {
    clearTimeout(temporizador);
  }

  // 6. Respuesta 204 (Sin contenido)
  if (response.status === 204) {
    return null as T;
  }

  // Intentar parsear el cuerpo como JSON (maneja cuerpos vacíos o texto plano de forma segura)
  const cuerpoJson = await response.json().catch(() => ({}));

  // 7. Manejo de errores HTTP
  if (!response.ok) {
    if (response.status === 401 && ruta !== '/login') {
      await olvidarSesion();
      await router.replace('/login');
    }
    throw new ErrorApi(response.status, cuerpoJson);
  }

  // 8. Respuesta exitosa con JSON
  return cuerpoJson as T;
}