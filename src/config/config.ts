class Config {
  private static instance: Config

  public baseUrl: string | null = '127.0.0.1:8001'
  public apiUrl = `http://${this.baseUrl}/api`
  public wsUrl = `ws://${this.baseUrl}/api`

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config()
    }
    return Config.instance
  }
  public setBaseUrl(url: string): void {
    this.baseUrl = url
    this.apiUrl = `http://${url}/api`
    this.wsUrl = `ws://${url}/api`
  }
}
const appConfig = Config.getInstance()

export { Config, appConfig }
