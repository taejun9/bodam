<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";

import {
  customerIdentities,
  identityHint,
  identityLabel,
} from "@/features/family/components/family-identity";
import type {
  FamilyCustomerOption,
  FamilyDetail,
  FamilyMemberView,
} from "@/features/family/types/family";
import AppButton from "@/shared/components/AppButton.vue";

const props = defineProps<{
  detail: FamilyDetail;
  available: readonly FamilyCustomerOption[];
}>();
const emit = defineEmits<{
  add: [];
  edit: [member: FamilyMemberView];
  remove: [member: FamilyMemberView];
}>();

const moneyFormatter = new Intl.NumberFormat("ko-KR");
const identities = computed(() => customerIdentities(props.detail, props.available));

function label(member: FamilyMemberView): string {
  return identityLabel(identities.value, member.customerId, "고객");
}

function hint(member: FamilyMemberView): string | undefined {
  return identityHint(identities.value, member.customerId, "고객");
}
</script>

<template>
  <section data-testid="family-member-list">
    <header class="family-member-toolbar">
      <div class="family-member-total">
        <span>가족 월보험료 합계</span>
        <strong data-testid="family-member-total">
          {{ moneyFormatter.format(detail.totalMonthlyPremiumWon) }}원
        </strong>
        <small>활성 구성원 {{ detail.members.length }}명</small>
      </div>
      <AppButton
        variant="primary"
        data-testid="add-family-member"
        :disabled="available.length === 0"
        :title="available.length === 0 ? '추가할 활성 고객이 없습니다.' : undefined"
        :aria-describedby="available.length === 0 ? 'family-member-availability-note' : undefined"
        :autofocus="available.length > 0"
        @click="emit('add')"
      >
        <span aria-hidden="true">+</span>
        구성원 추가
      </AppButton>
    </header>

    <p
      v-if="available.length === 0"
      id="family-member-availability-note"
      class="family-relationship-note"
      role="status"
    >추가할 활성 고객이 없습니다. 모든 활성 고객이 이미 연결되어 있거나 먼저 고객 등록이 필요합니다.</p>

    <div v-if="detail.members.length === 0" class="family-member-state is-compact">
      <strong>아직 연결된 활성 고객이 없습니다</strong>
      <span v-if="available.length > 0">구성원 추가에서 기존 고객을 선택해 주세요.</span>
      <template v-else>
        <span>추가할 활성 고객이 없습니다. 먼저 고객을 등록해 주세요.</span>
        <RouterLink to="/customers" autofocus>고객 목록으로 이동</RouterLink>
      </template>
    </div>

    <ul v-else class="family-member-list">
      <li
        v-for="(member, index) in detail.members"
        :key="member.membershipId"
        data-testid="family-member-row"
        :data-membership-id="member.membershipId"
        :data-customer-id="member.customerId"
      >
        <span class="family-member-identity">
          <RouterLink
            :to="{ name: 'customer-detail', params: { customerId: member.customerId } }"
            data-testid="family-member-customer-link"
            :aria-label="`${label(member)} 고객 상세`"
            :autofocus="available.length === 0 && index === 0"
          >{{ member.customerName }}</RouterLink>
          <small v-if="hint(member)" class="identity-hint">{{ hint(member) }}</small>
          <small>{{ member.relationshipName ?? "관계명 미입력" }}</small>
        </span>
        <span class="family-member-premium">
          <strong>{{ moneyFormatter.format(member.totalMonthlyPremiumWon) }}원</strong>
          <small>합계대상 계약 {{ member.includedPolicyCount }}건</small>
        </span>
        <span class="family-member-actions">
          <button
            type="button"
            data-testid="edit-family-member"
            :aria-label="`${label(member)} 관계명 수정`"
            @click="emit('edit', member)"
          >수정</button>
          <button
            class="danger-action"
            type="button"
            data-testid="delete-family-member"
            :aria-label="`${label(member)} 구성원 연결 삭제`"
            @click="emit('remove', member)"
          >삭제</button>
        </span>
      </li>
    </ul>
  </section>
</template>
