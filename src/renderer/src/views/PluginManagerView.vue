<template>
  <div class="background-container">
    <div class="dashboard-content">
      <div class="unavailable">
        <div class="decoration-container">
          <div class="orb main"></div>
          <div class="orb secondary"></div>
          <div class="orb tertiary"></div>
        </div>
        <div class="text-content">
          <h1 class="page-title">✨ 沉睡的魔法工坊 ✨</h1>
          <p class="page-title-description">或许在未来的某个时刻，这个页面将会开放</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.unavailable {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
}

.decoration-container {
  position: relative;
  width: 150px;
  height: 150px;
  margin-bottom: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.orb {
  position: absolute;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--theme-color-light), var(--theme-color));
  filter: blur(1px);
  opacity: 0.7;
  animation: float 6s ease-in-out infinite;
}

.orb.main {
  width: 90px;
  height: 90px;
  box-shadow: 0 0 40px 15px var(--theme-color-shadow);
  z-index: 1;
}

.orb.secondary {
  width: 45px;
  height: 45px;
  background: linear-gradient(135deg, #fff, var(--theme-color-light));
  top: 15px;
  right: 15px;
  animation: float 5s ease-in-out infinite reverse;
  opacity: 0.9;
  filter: blur(1px);
  z-index: 2;
}

.orb.tertiary {
  width: 30px;
  height: 30px;
  background: var(--theme-color);
  bottom: 25px;
  left: 20px;
  animation: float 4s ease-in-out infinite 1s;
  opacity: 0.6;
}

.text-content {
  text-align: center;
  z-index: 3;
  animation: fadeIn 1.5s ease-out;
}

.page-title {
  background: linear-gradient(45deg, var(--theme-color-dark), var(--theme-color-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-top: 0;
  margin-bottom: 12px;
  text-shadow: 0 2px 10px var(--theme-color-shadow);
  font-weight: 900;
  letter-spacing: 2px;
}

.page-title-description {
  color: var(--theme-text-color-dark);
  opacity: 0.7;
  letter-spacing: 1px;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-15px) scale(1.05);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
