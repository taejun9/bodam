import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "@/App.vue";
import router from "@/app/router";
import { appSettingsApplication } from "@/app/composition/settings";
import { useUiStore } from "@/app/stores/ui";
import "@/assets/main.css";

async function bootstrap() {
  if (__BODAM_E2E__) {
    await import("@wdio/tauri-plugin");
  }

  const app = createApp(App);
  const pinia = createPinia();

  app.use(pinia);
  app.use(router);

  const ui = useUiStore(pinia);
  ui.initialize();
  try {
    ui.setTheme((await appSettingsApplication.load()).theme);
  } catch {
    // The first-paint cache remains usable until Settings can be retried in-app.
  }

  app.mount("#app");
}

void bootstrap();
