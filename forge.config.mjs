import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

export default {
  packagerConfig: {
    icon: './asset/icon/app',
    prune: true,
    ignore: [
      // 忽略开发相关文件
      '^/\\.git($|/)',
      '^/node_modules/(\\.cache|\\.bin)',
      '^/src($|/)',
      '^/tests?($|/)',
      '^/doc?($|/)',
      '^/coverage($|/)',

      // 忽略特定的大文件
      '\\.(log|md|txt)$',
      '(^|/)\\..*\\.(swp|tmp|bak)$',

      // 忽略开发工具配置
      '^/\\.(vscode|idea)($|/)',
      '^/.*\\.config\\.js$',

      // 忽略未使用的 node_modules
      '^/node_modules/@types($|/)',
      '^/node_modules/.*devDependencies.*',
      '^/out($|/)',
      '^/public($|/)',
    ],
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    // {
    //   name: '@electron-forge/plugin-auto-unpack-natives',
    //   config: {},
    // },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}
