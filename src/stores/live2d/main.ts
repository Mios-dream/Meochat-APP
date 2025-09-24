import { LAppDelegate } from './delegate'
import * as LAppDefine from './define'

/**
 * ブラウザロード後の処理
 */
window.addEventListener(
  'load',
  (): void => {
    // Initialize WebGL and create the application instance
    if (!LAppDelegate.getInstance().initialize()) {
      return
    }

    LAppDelegate.getInstance().run()
  },
  { passive: true },
)

/**
 * 終了時の処理
 */
window.addEventListener('beforeunload', (): void => LAppDelegate.releaseInstance(), {
  passive: true,
})
