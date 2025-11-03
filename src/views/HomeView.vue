<template>
  <div class="background-container">
    <div class="dashboard-content">
      <h1 class="page-title">主页</h1>
      <p class="page-title-description">你好，阁下！今天是我陪伴阁下的第100天！</p>
      <div class="top-cards">
        <div class="card purple-card">
          <div class="card-head">
            <div class="card-icon">
              <div class="icon">
                <font-awesome-icon icon="fa-solid fa-square-binary" />
              </div>
            </div>
            <div class="card-content">
              <p class="card-title">Token消耗</p>
              <p class="card-value">{{ token }}</p>
              <p class="card-description"></p>
            </div>
          </div>
          <div class="card-footer">日均0/总消耗0</div>
        </div>
        <div class="card blue-card">
          <div class="card-head">
            <div class="card-icon">
              <div class="icon">
                <font-awesome-icon icon="fa-solid fa-heart-pulse" />
              </div>
            </div>
            <div class="card-content">
              <p class="card-title">助手执勤时间</p>
              <p class="card-value">{{ token }}</p>
              <p class="card-description"></p>
            </div>
          </div>
          <div class="card-footer">累计0年0小时0分</div>
        </div>
        <div class="card pink-card">
          <div class="card-head">
            <div class="card-icon">
              <div class="icon">
                <font-awesome-icon icon="fa-solid fa-microchip" />
              </div>
            </div>
            <div class="card-content">
              <p class="card-title">内存占用</p>
              <p class="card-value">{{ token }}</p>
              <p class="card-description"></p>
            </div>
          </div>
          <div class="card-footer">日均0/总消耗0</div>
        </div>
      </div>
      <div class="main-content">
        <div class="log-card card">
          <div class="log-heard">
            <h2 class="card-title">日志</h2>
            <div class="log-level">
              <div class="log-level-item">
                <div class="log-level-flag level-error"></div>
                <div class="log-level-value">0</div>
              </div>
              <div class="log-level-item">
                <div class="log-level-flag level-warning"></div>
                <div class="log-level-value">0</div>
              </div>
              <div class="log-level-item">
                <div class="log-level-flag level-info"></div>
                <div class="log-level-value">0</div>
              </div>
            </div>
          </div>
          <div class="log-body">
            <div v-if="log.length <= 0" class="no-log">暂无日志</div>
            <div v-else class="log-list"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const log = ref([])
const token = ref(1000)
</script>

<style scoped>
.top-cards {
  display: grid;
  height: 170px;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: 1fr;
  gap: 20px;
}

.card {
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border-radius: 20px;
  padding: 20px;
  transition: all 0.3s ease-in-out;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);
}

.card:hover {
  transform: translateY(-3px);
}

.card-icon {
  width: 60px;
  height: 100%;
}
.card-icon .icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 60px;
  height: 60px;
  font-size: 40px;
  background-color: #f9fafc;
  border-radius: 15px;
}

.purple-card {
  color: #a785ff;
}

.blue-card {
  color: #fb7299;
}

.pink-card {
  color: #ffa73b;
}

.card-head {
  display: flex;
  flex-direction: row;
  justify-content: start;
  align-items: center;
  height: 50%;
}

.card-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: start;
  align-items: start;
  margin-left: 20px;
}

.card-title {
  font-size: 16px;
  margin: 0;
  /* color: rgba(255, 255, 255, 0.6); */
}

.card-value {
  margin: 0;
  font-size: 30px;
  font-weight: bold;
}

.card-description {
  margin: 0;
}

.card-footer {
  width: 100%;
  height: 100%;
  margin-top: 15px;
  background-color: #f9fafc;
  border-radius: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.main-content {
  margin-top: 30px;
  display: grid;
  width: 100%;
  height: 500px;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.log-card {
  background-color: #f9fafc;
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);
  grid-row: 1 / 3;
}

.log-card .card-title {
  font-size: 25px;
}

.log-heard {
  display: flex;
  height: 40px;
  justify-content: space-between;
  align-items: end;
}

.log-level {
  width: 200px;
  display: flex;
  flex-direction: row;
  margin-left: 20px;
  justify-content: space-between;
}

.log-level-item {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.log-level-flag {
  width: 15px;
  height: 15px;
  border-radius: 100px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);
}

.log-level-value {
  margin-left: 10px;
  color: black;
  font-size: 28px;
  font-weight: bold;
}

.level-error {
  background-color: rgb(255, 115, 115);
}

.level-warning {
  background-color: rgb(255, 227, 115);
}
.level-info {
  background-color: rgb(105, 219, 90);
}

.log-body {
  display: grid;
  height: 100%;
  width: 100%;
  grid-template-columns: repeat(1, 1fr);
  grid-template-rows: repeat(5, 1fr);
}

.no-log {
  width: 100%;
  height: 100%;

  grid-row: 1 / 5;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
