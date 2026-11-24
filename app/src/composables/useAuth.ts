import { computed, ref } from 'vue';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Device } from '@capacitor/device';
import { api } from '@/services/api';

export interface Usuario { id: number; nombre: string }

const CLAVE_TOKEN = 'token';
const CLAVE_USUARIO = 'usuario';

// Estado compartido por toda la app (fuera de la función = un solo valor) — YA IMPLEMENTADO
const token = ref<string | null>(null);
const usuario = ref<Usuario | null>(null);
let tokenCargado = false;

/** YA IMPLEMENTADO — lo usa services/api.ts para armar el encabezado Authorization. */
export const obtenerToken = () => token.value;

/**
 * Borrar token y usuario de la memoria (refs) y del almacenamiento cifrado.
 */
export async function olvidarSesion() {
  token.value = null;
  usuario.value = null;
  await Promise.allSettled([
    SecureStorage.remove(CLAVE_TOKEN),
    SecureStorage.remove(CLAVE_USUARIO),
  ]);
}

export function useAuth() {
  const estaAutenticado = computed(() => token.value !== null);

  /**
   * login(email, password)
   *  1. device_name = `${plataforma} ${modelo}` usando Device.getInfo() (máx. 60 caracteres).
   *  2. POST /login con { email, password, device_name } usando api().
   *  3. Guardar token y usuario en los refs y en SecureStorage.
   */
  async function login(email: string, password: string) {
    const info = await Device.getInfo();
    const device_name = `${info.platform} ${info.model}`.trim().slice(0, 60);

    const respuesta = await api<{ token: string; usuario: Usuario }>('/login', {
      method: 'POST',
      body: { email, password, device_name },
    });

    token.value = respuesta.token;
    usuario.value = respuesta.usuario;

    await SecureStorage.set(CLAVE_TOKEN, respuesta.token);
    await SecureStorage.set(CLAVE_USUARIO, JSON.stringify(respuesta.usuario));
  }

  /**
   * cargarToken()
   *  Al abrir la app, recupera token y usuario de SecureStorage y los pone en los refs.
   *  Debe ejecutarse una sola vez (use la bandera tokenCargado).
   */
  async function cargarToken() {
    if (tokenCargado) return;
    tokenCargado = true;

    try {
      const tokenGuardado = await SecureStorage.get(CLAVE_TOKEN);
      const usuarioGuardado = await SecureStorage.get(CLAVE_USUARIO);

      if (typeof tokenGuardado === 'string' && tokenGuardado.length > 0) {
        token.value = tokenGuardado;
      }

      if (typeof usuarioGuardado === 'string' && usuarioGuardado.length > 0) {
        usuario.value = JSON.parse(usuarioGuardado) as Usuario;
      }
    } catch {
      await olvidarSesion();
    }
  }

  /**
   * cerrarSesion()
   *  POST /logout para revocar el token en el servidor y SIEMPRE borrar la sesión local,
   *  aunque la API falle (sin red o token vencido).
   */
  async function cerrarSesion() {
    try {
      await api('/logout', { method: 'POST' });
    } finally {
      await olvidarSesion();
    }
  }

  return { usuario, estaAutenticado, login, cargarToken, cerrarSesion };
}