import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "@/App.vue";
import router from "@/app/router";
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

  useUiStore(pinia).initialize();

  app.mount("#app");
}

void bootstrap();
