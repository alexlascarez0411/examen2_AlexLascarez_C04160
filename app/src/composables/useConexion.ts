import { onMounted, onUnmounted, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Network } from '@capacitor/network';

/**
 * useConexion() devuelve { conectado, tipo }:
 *  - Valor inicial con Network.getStatus()
 *  - Se actualiza con Network.addListener('networkStatusChange', ...)
 *  - El oyente se libera (handle.remove()) cuando se destruye la página (onUnmounted).
 */
export function useConexion() {
  const conectado = ref(true);
  const tipo = ref('unknown');
  let handle: PluginListenerHandle | null = null;

  onMounted(async () => {
    const estadoInicial = await Network.getStatus();
    conectado.value = estadoInicial.connected;
    tipo.value = estadoInicial.connectionType;

    handle = await Network.addListener('networkStatusChange', (estado) => {
      conectado.value = estado.connected;
      tipo.value = estado.connectionType;
    });
  });

  onUnmounted(async () => {
    await handle?.remove();
  });

  return { conectado, tipo };
}

/**
 * vibrar(): vibración breve de confirmación con Haptics.impact({ style: ImpactStyle.Light }).
 * En el navegador no hace nada (Capacitor.isNativePlatform()).
 */
export async function vibrar() {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.impact({ style: ImpactStyle.Light });
}