export interface RuntimeApi {
  runtime: {
    getWindowType: () => 'main' | 'assistant' | 'chat-box'
  }
}
