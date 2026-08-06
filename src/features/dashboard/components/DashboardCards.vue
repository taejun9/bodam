<script setup lang="ts">
import DashboardCard from "@/features/dashboard/components/DashboardCard.vue";
import DashboardContactItem from "@/features/dashboard/components/DashboardContactItem.vue";
import DashboardCoverageItem from "@/features/dashboard/components/DashboardCoverageItem.vue";
import DashboardPremiumItem from "@/features/dashboard/components/DashboardPremiumItem.vue";
import DashboardUpcomingItem from "@/features/dashboard/components/DashboardUpcomingItem.vue";
import type { DashboardReadModel } from "@/features/dashboard/types/dashboard";

const props = defineProps<{ model: DashboardReadModel }>();
</script>

<template>
  <div class="dashboard-grid" data-testid="dashboard-grid">
    <DashboardCard
      metric="today-contact"
      title="오늘 연락"
      description="오늘까지 연락 예정인 관리 고객"
      :total-count="props.model.todayContact.totalCount"
      :visible-count="props.model.todayContact.items.length"
      :is-truncated="props.model.todayContact.isTruncated"
      empty-text="오늘 연락할 고객이 없습니다."
    >
      <DashboardContactItem
        v-for="item in props.model.todayContact.items"
        :key="item.customerId"
        :item="item"
      />
    </DashboardCard>

    <DashboardCard
      metric="insurance-age"
      title="상령 예정"
      description="90일 안에 보험 나이가 오르는 고객"
      :total-count="props.model.insuranceAge.totalCount"
      :visible-count="props.model.insuranceAge.items.length"
      :is-truncated="props.model.insuranceAge.isTruncated"
      empty-text="90일 안에 상령 예정인 고객이 없습니다."
    >
      <DashboardUpcomingItem
        v-for="item in props.model.insuranceAge.items"
        :key="item.customerId"
        :item="item"
      />
    </DashboardCard>

    <DashboardCard
      metric="maturity"
      title="만기 예정"
      description="90일 안에 만기되는 보험계약"
      :total-count="props.model.maturity.totalCount"
      :visible-count="props.model.maturity.items.length"
      :is-truncated="props.model.maturity.isTruncated"
      empty-text="90일 안에 만기 예정인 계약이 없습니다."
    >
      <DashboardUpcomingItem
        v-for="item in props.model.maturity.items"
        :key="item.policyId"
        :item="item"
      />
    </DashboardCard>

    <DashboardCard
      metric="premium-top"
      title="보험료 TOP"
      description="월보험료 합계가 높은 관리 고객"
      :total-count="props.model.premiumTop.totalCount"
      :visible-count="props.model.premiumTop.items.length"
      :is-truncated="props.model.premiumTop.isTruncated"
      empty-text="합계대상 월보험료가 있는 고객이 없습니다."
    >
      <DashboardPremiumItem
        v-for="item in props.model.premiumTop.items"
        :key="item.customerId"
        :item="item"
      />
    </DashboardCard>

    <DashboardCard
      metric="family-premium"
      title="가족 보험료"
      description="월보험료 합계가 높은 가족"
      :total-count="props.model.familyPremium.totalCount"
      :visible-count="props.model.familyPremium.items.length"
      :is-truncated="props.model.familyPremium.isTruncated"
      empty-text="월보험료 합계가 있는 가족이 없습니다."
    >
      <DashboardPremiumItem
        v-for="item in props.model.familyPremium.items"
        :key="item.familyId"
        :item="item"
      />
    </DashboardCard>

    <DashboardCard
      metric="coverage-insufficient"
      title="보장 부족 고객"
      description="사용자 설정 기준보다 부족한 보장이 있는 고객"
      :total-count="props.model.coverageInsufficient.totalCount"
      :visible-count="props.model.coverageInsufficient.items.length"
      :is-truncated="props.model.coverageInsufficient.isTruncated"
      empty-text="설정 기준에서 부족으로 판정된 고객이 없습니다."
    >
      <DashboardCoverageItem
        v-for="item in props.model.coverageInsufficient.items"
        :key="item.customerId"
        :item="item"
      />
    </DashboardCard>

    <DashboardCard
      metric="recent-consultation"
      title="최근 상담"
      description="오늘 포함 최근 30일에 상담한 고객"
      :total-count="props.model.recentConsultation.totalCount"
      :visible-count="props.model.recentConsultation.items.length"
      :is-truncated="props.model.recentConsultation.isTruncated"
      empty-text="최근 30일에 상담한 고객이 없습니다."
    >
      <DashboardContactItem
        v-for="item in props.model.recentConsultation.items"
        :key="item.consultationId"
        :item="item"
      />
    </DashboardCard>

    <DashboardCard
      metric="unconsulted"
      title="최근 미상담"
      description="90일 이상 상담하지 않았거나 상담 기록이 없는 고객"
      :total-count="props.model.unconsulted.totalCount"
      :visible-count="props.model.unconsulted.items.length"
      :is-truncated="props.model.unconsulted.isTruncated"
      empty-text="최근 미상담 관리 고객이 없습니다."
    >
      <DashboardContactItem
        v-for="item in props.model.unconsulted.items"
        :key="item.customerId"
        :item="item"
      />
    </DashboardCard>
  </div>
</template>
