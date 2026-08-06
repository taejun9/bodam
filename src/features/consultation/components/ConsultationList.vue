<script setup lang="ts">
import { formatConsultedAtLocal } from "@/features/consultation/services/consultation-datetime";
import type { Consultation } from "@/features/consultation/types/consultation";

defineProps<{
  consultations: readonly Consultation[];
}>();

const emit = defineEmits<{
  edit: [consultation: Consultation];
  remove: [consultation: Consultation];
}>();

function textOrDash(value: string | null): string {
  return value ?? "—";
}

function dateOnlyLabel(value: string): string {
  return value.replaceAll("-", ". ");
}

function actionLabel(action: "수정" | "삭제", consultation: Consultation): string {
  return `상담 ${action} · 상담 ID ${consultation.id}`;
}
</script>

<template>
  <div class="consultation-table-wrap">
    <table class="consultation-table">
      <caption class="sr-only">고객 상담 기록</caption>
      <thead>
        <tr>
          <th scope="col">상담 일시</th>
          <th scope="col">상담 내용</th>
          <th scope="col">다음 연락일</th>
          <th scope="col">상담 결과</th>
          <th scope="col"><span class="sr-only">작업</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="consultation in consultations"
          :key="consultation.id"
          data-testid="consultation-row"
          :data-consultation-id="consultation.id"
        >
          <td class="consultation-date">
            <time data-testid="consulted-at" :datetime="consultation.consultedAt">
              {{ formatConsultedAtLocal(consultation.consultedAt) }}
            </time>
          </td>
          <td class="consultation-content">{{ textOrDash(consultation.content) }}</td>
          <td class="consultation-next-contact">
            <time
              v-if="consultation.nextContactOn"
              data-testid="next-contact-on"
              :datetime="consultation.nextContactOn"
            >{{ dateOnlyLabel(consultation.nextContactOn) }}</time>
            <span v-else>—</span>
          </td>
          <td class="consultation-result">{{ textOrDash(consultation.result) }}</td>
          <td>
            <div class="consultation-actions">
              <button
                type="button"
                data-testid="edit-consultation"
                :aria-label="actionLabel('수정', consultation)"
                @click="emit('edit', consultation)"
              >수정</button>
              <button
                type="button"
                class="danger-action"
                data-testid="delete-consultation"
                :aria-label="actionLabel('삭제', consultation)"
                @click="emit('remove', consultation)"
              >삭제</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="consultation-cards" aria-label="고객 상담 기록">
      <article
        v-for="consultation in consultations"
        :key="consultation.id"
        class="consultation-card"
        data-testid="consultation-row"
        :data-consultation-id="consultation.id"
      >
        <header>
          <time data-testid="consulted-at" :datetime="consultation.consultedAt">
            {{ formatConsultedAtLocal(consultation.consultedAt) }}
          </time>
          <span>{{ textOrDash(consultation.result) }}</span>
        </header>
        <p class="consultation-card-content">{{ textOrDash(consultation.content) }}</p>
        <dl>
          <div>
            <dt>다음 연락일</dt>
            <dd>
              <time
                v-if="consultation.nextContactOn"
                data-testid="next-contact-on"
                :datetime="consultation.nextContactOn"
              >{{ dateOnlyLabel(consultation.nextContactOn) }}</time>
              <span v-else>—</span>
            </dd>
          </div>
        </dl>
        <footer>
          <button
            type="button"
            data-testid="edit-consultation"
            :aria-label="actionLabel('수정', consultation)"
            @click="emit('edit', consultation)"
          >수정</button>
          <button
            type="button"
            class="danger-action"
            data-testid="delete-consultation"
            :aria-label="actionLabel('삭제', consultation)"
            @click="emit('remove', consultation)"
          >삭제</button>
        </footer>
      </article>
    </div>
  </div>
</template>
