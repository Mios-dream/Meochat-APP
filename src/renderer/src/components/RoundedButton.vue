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
  block: false
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const handleClick = (event: MouseEvent): void => {
  if (!props.disabled) {
    emit('click', event)
  }
}
</script>

<style scoped>
.button {
  padding: 8px 16px;
  background-color: transparent;
  color: var(--theme-color-light);
  border: 2px solid var(--theme-color-light);
  border-radius: 50px;
  cursor: pointer;
  font-size: 14px;
  transition:
    background-color 0.2s,
    color 0.2s,
    border-color 0.2s;
  min-width: 90px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
}

.button--block {
  width: 100%;
}

.button:hover:not(:disabled) {
  color: white;
  background-color: var(--theme-color);
  border: 2px solid var(--theme-color);
}

.button:disabled {
  color: white;
  background-color: var(--theme-color);
  border: 2px solid var(--theme-color);
  cursor: not-allowed;
}
</style>
