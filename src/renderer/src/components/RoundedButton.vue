<!-- src/components/RoundedButton.vue -->
<template>
  <button
    class="button"
    :class="{ 'button--block': block }"
    :type="type"
    :disabled="disabled"
    @click="handleClick"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
interface Props {
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  block?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  disabled: false,
  block: false,
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const handleClick = (event: MouseEvent) => {
  if (!props.disabled) {
    emit('click', event)
  }
}
</script>

<style scoped>
.button {
  cursor: pointer;
  position: relative;
  padding: 5px 24px;
  font-size: 18px;
  color: #fb7299;
  border: 2px solid #fb7299;
  border-radius: 34px;
  background-color: transparent;
  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  overflow: hidden;
  display: inline-flex;
  justify-content: center;
  align-items: center;
}

.button--block {
  width: 100%;
}

.button::before {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  width: 50px;
  height: 50px;
  border-radius: inherit;
  scale: 0;
  z-index: -1;
  background-color: #fca9c2;
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.button:hover::before {
  scale: 3;
}

.button:hover {
  color: white;
  scale: 1.1;
  box-shadow: 0 0px 20px #fb72994c;
}

.button:active {
  scale: 1;
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  scale: 1;
  box-shadow: none;
}

.button:disabled:hover {
  color: #fb7299;
  scale: 1;
}

.button:disabled::before {
  scale: 0;
}
</style>
