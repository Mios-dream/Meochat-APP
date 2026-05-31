<template>
  <transition name="error-fade">
    <div v-if="visible" class="model-error-container">
      <!-- 全屏暗角遮罩 -->
      <div class="vignette"></div>

      <!-- 大裂缝 - 从中心向外蔓延 -->
      <div class="rift rift-1"></div>
      <div class="rift rift-2"></div>
      <div class="rift rift-3"></div>
      <div class="rift rift-4"></div>
      <div class="rift rift-5"></div>
      <div class="rift rift-6"></div>
      <div class="rift rift-7"></div>
      <div class="rift rift-8"></div>

      <!-- 故障扫描线 -->
      <div class="glitch-line glitch-line-1"></div>
      <div class="glitch-line glitch-line-2"></div>
      <div class="glitch-line glitch-line-3"></div>
      <div class="glitch-line glitch-line-4"></div>
      <div class="glitch-line glitch-line-5"></div>
      <div class="glitch-line glitch-line-6"></div>
      <div class="glitch-line glitch-line-7"></div>
      <div class="glitch-line glitch-line-8"></div>

      <!-- 大碎片 -->
      <div class="debris debris-1"></div>
      <div class="debris debris-2"></div>
      <div class="debris debris-3"></div>
      <div class="debris debris-4"></div>
      <div class="debris debris-5"></div>
      <div class="debris debris-6"></div>
      <div class="debris debris-7"></div>
      <div class="debris debris-8"></div>

      <!-- 细小碎片 -->
      <div class="shard shard-1"></div>
      <div class="shard shard-2"></div>
      <div class="shard shard-3"></div>
      <div class="shard shard-4"></div>
      <div class="shard shard-5"></div>
      <div class="shard shard-6"></div>
      <div class="shard shard-7"></div>
      <div class="shard shard-8"></div>
      <div class="shard shard-9"></div>
      <div class="shard shard-10"></div>
      <div class="shard shard-11"></div>
      <div class="shard shard-12"></div>
    </div>
  </transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  message: string
}>()
</script>

<style scoped>
.model-error-container {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  z-index: 1000;
  pointer-events: none;
  animation: container-enter 0.8s ease both;
}

/* ========== 暗角遮罩 ========== */
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 20%,
    rgba(180, 60, 90, 0.06) 45%,
    rgba(120, 30, 60, 0.15) 75%,
    rgba(60, 10, 30, 0.3) 100%
  );
  animation: vignette-in 1.5s ease both;
  pointer-events: none;
}

@keyframes vignette-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ========== 大裂缝 - 从中心向外辐射 ========== */
.rift {
  position: absolute;
  top: 50%;
  left: 50%;
  height: 2px;
  background: linear-gradient(90deg, var(--theme-color), transparent);
  transform-origin: 0% 50%;
  opacity: 0;
  animation: rift-spread 0.8s ease both;
  border-radius: 1px;
}

.rift::after {
  content: '';
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  height: 10px;
  background: linear-gradient(90deg, rgba(251, 114, 153, 0.15), transparent);
  filter: blur(4px);
}

.rift-1 {
  width: 35vw;
  transform: rotate(5deg);
  animation-delay: 0.2s;
}
.rift-2 {
  width: 30vw;
  transform: rotate(52deg);
  animation-delay: 0.35s;
}
.rift-3 {
  width: 40vw;
  transform: rotate(118deg);
  animation-delay: 0.3s;
}
.rift-4 {
  width: 28vw;
  transform: rotate(175deg);
  animation-delay: 0.45s;
}
.rift-5 {
  width: 33vw;
  transform: rotate(215deg);
  animation-delay: 0.4s;
}
.rift-6 {
  width: 25vw;
  transform: rotate(285deg);
  animation-delay: 0.5s;
}
.rift-7 {
  width: 22vw;
  transform: rotate(325deg);
  animation-delay: 0.55s;
}
.rift-8 {
  width: 18vw;
  transform: rotate(68deg);
  animation-delay: 0.6s;
}

@keyframes rift-spread {
  from {
    opacity: 0;
    clip-path: inset(0 100% 0 0);
  }
  to {
    opacity: 0.5;
    clip-path: inset(0 0% 0 0);
  }
}

/* ========== 故障扫描线 ========== */
.glitch-line {
  position: absolute;
  left: 0;
  width: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(251, 114, 153, 0.08) 15%,
    rgba(251, 114, 153, 0.25) 50%,
    rgba(251, 114, 153, 0.08) 85%,
    transparent 100%
  );
  opacity: 0;
  animation: glitch-scan 4s ease-in-out infinite;
  pointer-events: none;
}

.glitch-line-1 {
  top: 12%;
  height: 2px;
  animation-delay: 0.3s;
}
.glitch-line-2 {
  top: 28%;
  height: 1px;
  animation-delay: 1.1s;
}
.glitch-line-3 {
  top: 44%;
  height: 3px;
  animation-delay: 0s;
}
.glitch-line-4 {
  top: 56%;
  height: 1px;
  animation-delay: 2.2s;
}
.glitch-line-5 {
  top: 68%;
  height: 2px;
  animation-delay: 0.7s;
}
.glitch-line-6 {
  top: 78%;
  height: 1px;
  animation-delay: 1.6s;
}
.glitch-line-7 {
  top: 36%;
  height: 1px;
  animation-delay: 2.8s;
}
.glitch-line-8 {
  top: 88%;
  height: 2px;
  animation-delay: 1.3s;
}

@keyframes glitch-scan {
  0%,
  100% {
    opacity: 0;
    transform: translateX(-30%);
  }
  10% {
    opacity: 0.8;
  }
  20% {
    opacity: 0;
    transform: translateX(40%);
  }
  30% {
    opacity: 0;
  }
  35% {
    opacity: 0.5;
    transform: translateX(10%);
  }
  40% {
    opacity: 0;
  }
  50% {
    opacity: 0;
  }
  55% {
    opacity: 0.7;
    transform: translateX(-15%);
  }
  60% {
    opacity: 0;
    transform: translateX(20%);
  }
}

/* ========== 大碎片 - 三角形碎片飘散 ========== */
.debris {
  position: absolute;
  background-color: rgba(251, 114, 153, 0.22);
  border: 1.5px solid rgba(251, 114, 153, 0.38);
  opacity: 0;
  animation: debris-drift 5.5s ease-in-out infinite;
  box-shadow:
    0 0 8px rgba(251, 114, 153, 0.15),
    inset 0 0 6px rgba(251, 114, 153, 0.08);
}

.debris::after {
  content: '';
  position: absolute;
  inset: -3px;
  background-color: rgba(251, 114, 153, 0.06);
  filter: blur(6px);
  border-radius: inherit;
  clip-path: inherit;
}

.debris-1 {
  top: 22%;
  left: 12%;
  width: 44px;
  height: 30px;
  clip-path: polygon(0 0, 100% 30%, 70% 100%);
  animation-delay: 0.3s;
}
.debris-2 {
  top: 18%;
  right: 10%;
  width: 38px;
  height: 38px;
  clip-path: polygon(20% 0, 100% 0, 80% 100%, 0 80%);
  animation-delay: 0.8s;
}
.debris-3 {
  bottom: 20%;
  left: 15%;
  width: 48px;
  height: 28px;
  clip-path: polygon(30% 0, 100% 20%, 70% 100%, 0 60%);
  animation-delay: 0.5s;
}
.debris-4 {
  bottom: 15%;
  right: 12%;
  width: 34px;
  height: 42px;
  clip-path: polygon(50% 0, 100% 40%, 80% 100%, 0 80%);
  animation-delay: 1s;
}
.debris-5 {
  top: 40%;
  left: 6%;
  width: 28px;
  height: 36px;
  clip-path: polygon(0 20%, 100% 0, 60% 100%);
  animation-delay: 0.6s;
}
.debris-6 {
  top: 32%;
  right: 8%;
  width: 42px;
  height: 24px;
  clip-path: polygon(10% 0, 100% 30%, 50% 100%);
  animation-delay: 1.2s;
}
.debris-7 {
  top: 58%;
  left: 8%;
  width: 26px;
  height: 30px;
  clip-path: polygon(40% 0, 100% 20%, 70% 100%, 0 70%);
  animation-delay: 0.9s;
}
.debris-8 {
  bottom: 32%;
  right: 6%;
  width: 36px;
  height: 22px;
  clip-path: polygon(0 0, 100% 10%, 80% 100%, 10% 80%);
  animation-delay: 1.4s;
}

@keyframes debris-drift {
  0%,
  100% {
    opacity: 0;
    transform: translateY(0) rotate(0deg);
  }
  10% {
    opacity: 0.75;
  }
  50% {
    opacity: 0.5;
    transform: translateY(-22px) rotate(14deg);
  }
  90% {
    opacity: 0.6;
  }
}

/* ========== 细小碎片 ========== */
.shard {
  position: absolute;
  background-color: var(--theme-color);
  opacity: 0;
  animation: shard-fall 3s ease-in-out infinite;
  box-shadow: 0 0 4px rgba(251, 114, 153, 0.4);
}

.shard-1 {
  top: 30%;
  left: 22%;
  width: 8px;
  height: 3px;
  animation-delay: 0s;
}
.shard-2 {
  top: 24%;
  right: 25%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation-delay: 0.5s;
}
.shard-3 {
  top: 45%;
  left: 14%;
  width: 10px;
  height: 3px;
  animation-delay: 1s;
}
.shard-4 {
  bottom: 32%;
  right: 20%;
  width: 4px;
  height: 8px;
  animation-delay: 0.3s;
}
.shard-5 {
  top: 55%;
  right: 14%;
  width: 7px;
  height: 3px;
  animation-delay: 1.5s;
}
.shard-6 {
  bottom: 26%;
  left: 28%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  animation-delay: 0.8s;
}
.shard-7 {
  top: 18%;
  left: 38%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  animation-delay: 1.8s;
}
.shard-8 {
  bottom: 40%;
  left: 10%;
  width: 9px;
  height: 3px;
  animation-delay: 0.6s;
}
.shard-9 {
  top: 38%;
  right: 6%;
  width: 3px;
  height: 7px;
  animation-delay: 1.2s;
}
.shard-10 {
  bottom: 20%;
  right: 32%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation-delay: 2s;
}
.shard-11 {
  top: 65%;
  left: 24%;
  width: 4px;
  height: 9px;
  animation-delay: 0.4s;
}
.shard-12 {
  top: 15%;
  right: 38%;
  width: 8px;
  height: 3px;
  animation-delay: 1.6s;
}

@keyframes shard-fall {
  0% {
    opacity: 0;
    transform: translateY(-10px) rotate(0deg);
  }
  15% {
    opacity: 0.7;
  }
  50% {
    opacity: 0.4;
    transform: translateY(16px) rotate(30deg);
  }
  85% {
    opacity: 0.55;
  }
  100% {
    opacity: 0;
    transform: translateY(24px) rotate(45deg);
  }
}

/* ========== 中心破碎图标 ========== */
.error-icon-ring {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-color: #fff;
  border: 2px solid #fb729940;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-color);
  font-size: 28px;
  animation:
    icon-enter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both,
    icon-breathe 3s ease-in-out 0.6s infinite;
  z-index: 1;
}

.error-icon-ring :deep(svg) {
  animation: icon-shake 0.6s ease 0.4s;
  filter: drop-shadow(0 0 6px #fb729930);
}

/* 裂缝装饰线 */
.crack {
  position: absolute;
  background-color: var(--theme-color);
  opacity: 0.35;
  border-radius: 1px;
}

.crack-1 {
  width: 18px;
  height: 1.5px;
  top: 14px;
  right: 8px;
  transform: rotate(-35deg);
  animation: crack-appear 0.3s ease 0.5s both;
}
.crack-2 {
  width: 12px;
  height: 1.5px;
  bottom: 16px;
  left: 10px;
  transform: rotate(25deg);
  animation: crack-appear 0.3s ease 0.65s both;
}
.crack-3 {
  width: 8px;
  height: 1.5px;
  top: 28px;
  left: 6px;
  transform: rotate(-60deg);
  animation: crack-appear 0.3s ease 0.8s both;
}

@keyframes crack-appear {
  from {
    opacity: 0;
    transform: scaleX(0);
  }
  to {
    opacity: 0.35;
    transform: scaleX(1);
  }
}

@keyframes icon-enter {
  from {
    opacity: 0;
    transform: scale(0.2) rotate(-20deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes icon-breathe {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 #fb729918;
  }
  50% {
    transform: scale(1.04);
    box-shadow: 0 0 0 8px #fb729908;
  }
}

@keyframes icon-shake {
  0%,
  100% {
    transform: rotate(0deg);
  }
  15% {
    transform: rotate(-10deg);
  }
  30% {
    transform: rotate(8deg);
  }
  45% {
    transform: rotate(-6deg);
  }
  60% {
    transform: rotate(4deg);
  }
  75% {
    transform: rotate(-2deg);
  }
}

/* ========== 文字区域 ========== */
.error-text-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  animation: text-enter 0.5s ease 0.2s both;
  z-index: 1;
}

.error-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--theme-color);
  font-family: 'LoliFont', sans-serif;
  letter-spacing: 2px;
  text-shadow: 0 0 12px rgba(251, 114, 153, 0.2);
}

.error-divider {
  display: flex;
  align-items: center;
  gap: 6px;
}

.divider-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--theme-color);
  opacity: 0.5;
}

.divider-line {
  width: 32px;
  height: 1.5px;
  background: linear-gradient(90deg, transparent, var(--theme-color-light), transparent);
}

.error-detail {
  font-size: 13px;
  color: var(--theme-text-color-dark, #666);
  line-height: 1.6;
  word-break: break-word;
  text-align: center;
  max-width: 260px;
}

@keyframes text-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========== 容器入场 ========== */
@keyframes container-enter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ========== Vue transition ========== */
.error-fade-enter-active {
  transition: opacity 0.4s ease;
}

.error-fade-leave-active {
  transition: opacity 0.5s ease;
}

.error-fade-enter-from {
  opacity: 0;
}

.error-fade-leave-to {
  opacity: 0;
}
</style>
