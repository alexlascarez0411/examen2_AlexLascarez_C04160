<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Equipos</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/tabs/equipos/nuevo" aria-label="Nuevo equipo">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="q" :debounce="400" placeholder="Buscar por código o nombre" @ion-input="buscar" />
      </ion-toolbar>
      <!-- YA IMPLEMENTADO: depende de useConexion() [M7] -->
      <ion-toolbar v-if="!conectado" color="warning">
        <ion-title size="small">Sin conexión: los datos pueden estar desactualizados</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Refresher para recargar desde la página 1 -->
      <ion-refresher slot="fixed" @ionRefresh="refrescar">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Estado de carga inicial con ion-skeleton-text -->
      <ion-list v-if="cargando && equipos.length === 0">
        <ion-item v-for="n in 6" :key="n">
          <ion-label>
            <h2><ion-skeleton-text :animated="true" style="width: 65%" /></h2>
            <p><ion-skeleton-text :animated="true" style="width: 45%" /></p>
          </ion-label>
          <ion-skeleton-text slot="end" :animated="true" style="width: 75px; height: 22px; border-radius: 12px" />
        </ion-item>
      </ion-list>

      <!-- Estado de error con botón Reintentar -->
      <div v-else-if="error && equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="cloudOfflineOutline" size="large" color="medium" />
        <p>{{ error }}</p>
        <ion-button fill="outline" @click="cargar(true)">Reintentar</ion-button>
      </div>

      <!-- Estado vacío -->
      <div v-else-if="!cargando && equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="searchOutline" size="large" color="medium" />
        <p>No se encontraron equipos registrados.</p>
      </div>

      <!-- Listado de equipos con ion-item-sliding (M4 + M6) -->
      <ion-list v-else>
        <ion-item-sliding v-for="equipo in equipos" :key="equipo.id">
          <ion-item :router-link="`/tabs/equipos/${equipo.id}/editar`" button detail>
            <ion-label>
              <h2>{{ equipo.nombre }}</h2>
              <p>{{ equipo.codigo }} · {{ equipo.categoria.nombre }}</p>
            </ion-label>
            <ion-badge slot="end" :color="colorEstado[equipo.estado]">
              {{ equipo.estado }}
            </ion-badge>
          </ion-item>

          <ion-item-options side="end">
            <ion-item-option color="danger" @click="confirmarEliminacion(equipo, $event)">
              <ion-icon slot="start" :icon="trashOutline" />
              Eliminar
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <!-- Paginación infinita -->
      <ion-infinite-scroll :disabled="!hayMas" @ionInfinite="cargarMas">
        <ion-infinite-scroll-content />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonSearchbar, IonContent,
  IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonSkeletonText, IonBadge,
  IonItemSliding, IonItemOptions, IonItemOption, IonInfiniteScroll, IonInfiniteScrollContent,
  alertController, onIonViewWillEnter,
} from '@ionic/vue';
import type { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/vue';
import { add, cloudOfflineOutline, searchOutline, trashOutline } from 'ionicons/icons';
import { eliminar, listar, type Equipo, type Estado } from '@/services/equipos';
import { ErrorApi } from '@/services/errores';
import { mostrarToast } from '@/services/avisos';
import { useConexion, vibrar } from '@/composables/useConexion';

const colorEstado: Record<Estado, string> = { disponible: 'success', prestado: 'warning', mantenimiento: 'medium' };

const { conectado } = useConexion();

const equipos = ref<Equipo[]>([]);
const pagina = ref(0);
const ultimaPagina = ref(1);
const q = ref('');
const cargando = ref(false);
const error = ref('');
const hayMas = computed(() => pagina.value < ultimaPagina.value);

/**
 * cargar(reiniciar) [M4]
 */
async function cargar(reiniciar = false) {
  if (cargando.value) return;
  if (!reiniciar && !hayMas.value) return;

  const paginaObjetivo = reiniciar ? 1 : pagina.value + 1;
  cargando.value = true;
  error.value = '';

  try {
    const respuesta = await listar(paginaObjetivo, q.value.trim());
    equipos.value = reiniciar
      ? respuesta.data
      : [...equipos.value, ...respuesta.data];
    pagina.value = respuesta.meta.current_page;
    ultimaPagina.value = respuesta.meta.last_page;
  } catch (err) {
    if (err instanceof ErrorApi) {
      if (err.status === 401) return;
      error.value = err.message || 'No fue posible cargar los equipos.';
    } else {
      error.value = 'No fue posible cargar los equipos.';
    }
    if (!reiniciar) {
      await mostrarToast(error.value, 'danger');
    }
  } finally {
    cargando.value = false;
  }
}

/**
 * Recargar cada vez que el usuario entra o regresa a la vista [M4]
 */
onIonViewWillEnter(() => {
  cargar(true);
});

const buscar = () => cargar(true);

/** Recargar desde la página 1 y cerrar el refresher [M4] */
async function refrescar(evento: RefresherCustomEvent) {
  try {
    await cargar(true);
  } finally {
    await evento.target.complete();
  }
}

/** Cargar la página siguiente y cerrar el infinite scroll [M4] */
async function cargarMas(evento: InfiniteScrollCustomEvent) {
  try {
    await cargar(false);
  } finally {
    await evento.target.complete();
  }
}

/**
 * confirmarEliminacion(equipo, evento) [M6]
 */
async function confirmarEliminacion(equipo: Equipo, evento: Event) {
  // 1. Cerrar el ion-item-sliding padre del botón pulsado
  const objetivo = evento.target as HTMLElement | null;
  const sliding = objetivo?.closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
  await sliding?.close();

  // 2. Confirmación con alertController leyendo el role
  const alerta = await alertController.create({
    header: 'Eliminar equipo',
    message: `¿Seguro que desea eliminar "${equipo.nombre}" (${equipo.codigo})?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });

  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  // 3. Ejecutar eliminación y manejar respuestas 204, 409 y 404
  try {
    await eliminar(equipo.id);
    equipos.value = equipos.value.filter((item) => item.id !== equipo.id);
    await vibrar();
    await mostrarToast('Equipo eliminado correctamente.', 'success');
  } catch (err) {
    if (err instanceof ErrorApi) {
      if (err.status === 409) {
        await mostrarToast(err.message || 'No se puede eliminar un equipo prestado.', 'warning');
        return;
      }
      if (err.status === 404) {
        equipos.value = equipos.value.filter((item) => item.id !== equipo.id);
        await mostrarToast('El equipo ya no existe.', 'medium');
        return;
      }
      if (err.status === 401) return;
      await mostrarToast(err.message || 'Error al eliminar el equipo.', 'danger');
    } else {
      await mostrarToast('Error al eliminar el equipo.', 'danger');
    }
  }
}
</script>