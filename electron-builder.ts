/**
 * electron-builder 构建配置
 *
 * 仅构建一个应用包：内置当前平台的 moechat-assets-*-{win|linux}-lite.zip。
 * 资产包包含内核源码、必要运行数据和助手资源；依赖与大模型由首次运行在线安装。
 *
 * 平台支持：
 * - Windows：NSIS 安装包。
 * - Linux  ：AppImage / deb 安装包。
 *
 * 一键构建：
 *   scripts/build-all.ps1 -KernelSource <后端dist目录>        # 默认仅 Windows 安装版
 *   scripts/build-all-linux.ps1 -KernelSource <后端dist目录>  # 默认仅 Linux 安装版
 *
 * 配套 npm scripts：
 *   npm run build:win                # Windows：NSIS 安装包
 *   npm run build:linux              # Linux：AppImage / deb
 *
 * 说明：本文件为函数式配置，electron-builder 自动探测 electron-builder.ts
 * 并通过 jiti 运行时加载；electron-builder.yml 已废弃，避免双配置源造成维护漂移。
 *
 * 注意：Configuration 类型须从 app-builder-lib 导入，而不能从 electron-builder 导入——
 * tsconfig.node.json 设置了 baseUrl，会导致 'electron-builder' 被解析成本文件
 * （electron-builder.ts）从而遮蔽 node_modules 中的真实包；app-builder-lib 无此冲突。
 */

import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Configuration } from 'app-builder-lib'

/** 当前配置文件所在目录（即项目根目录） */
const projectRoot = dirname(fileURLToPath(import.meta.url))
/**
 * 校验构建前置条件：resources/kernel-assets 中必须存在当前平台的 lite 内核资产包。
 */
function assertAssetsReady(platformTag: 'win' | 'linux'): void {
  const assetsDir = join(projectRoot, 'resources', 'kernel-assets')
  if (!existsSync(assetsDir)) return
  const fileNames = readdirSync(assetsDir)

  // 必须存在内核源码资产包。
  const hasAssets = fileNames.some(
    (name) => name.startsWith('moechat-assets-') && name.endsWith('.zip')
  )
  if (!hasAssets) {
    throw new Error(
      'resources/kernel-assets 缺少内核源码资产包(moechat-assets-*.zip)。请先执行：\n' +
        '  .\\scripts\\prepare-kernel-assets.ps1 -KernelSource <后端dist目录>'
    )
  }

  const hasPlatformAssets = fileNames.some(
    (name) => name.startsWith('moechat-assets-') && name.endsWith(`-${platformTag}-lite.zip`)
  )
  if (!hasPlatformAssets) {
    throw new Error(
      `resources/kernel-assets 缺少 ${platformTag} lite 内核资产包(moechat-assets-*-${platformTag}-lite.zip)。请先执行：\n` +
        '  .\\scripts\\prepare-kernel-assets.ps1 -KernelSource <后端dist目录>'
    )
  }
}

/**
 * electron-builder 配置工厂（函数式导出，electron-builder 自动探测并调用）。
 * @returns 完整构建配置
 */
export default function electronBuilderConfig(): Configuration {
  // 当前构建所在平台：决定产物格式（win/linux 产物目标不同）。
  // 原生模块（node-pty/robotjs/uiohook/koffi）按平台编译，故跨平台打包需在目标平台执行，
  // 此处以构建机平台为准即可覆盖主流程（Windows 在 win 上构建、Linux 在 linux 上构建）。
  const isLinuxBuild = process.platform === 'linux'

  // 构建前置校验：资源包须与目标平台匹配。
  assertAssetsReady(isLinuxBuild ? 'linux' : 'win')

  /** 公共配置 */
  const base: Configuration = {
    appId: 'com.moechat.app',
    productName: 'moechat',
    directories: {
      buildResources: 'build',
      output: 'dist'
    },
    files: [
      '!**/.vscode/*',
      '!src/*',
      '!electron.vite.config.{js,ts,mjs,cjs}',
      '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}',
      '!{.env,.env.*,.npmrc,pnpm-lock.yaml}',
      '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}',
      // 以下目录仅作为 extraResources 分发，禁止重复打进 app.asar（避免体积翻倍）
      '!resources/kernel-assets/*',
      '!resources/python-runtime/*',
      '!pv',
      // 始终排除历史构建产物，避免被误打进 app.asar。
      '!dist/**'
    ],
    asarUnpack: ['resources/**'],
    extraResources: [
      { from: 'resources/python-runtime', to: 'python-runtime', filter: ['**/*'] },
      {
        from: 'resources/kernel-assets',
        to: 'kernel-assets',
        filter: ['**/*']
      }
    ],
    win: {
      icon: 'build/icon/app.ico',
      executableName: 'moechat',
      publish: [
        // an object provider for github with additional options
        { provider: 'github', protocol: 'https' }
      ]
    },
    mac: {
      entitlementsInherit: 'build/entitlements.mac.plist',
      extendInfo: [
        { NSCameraUsageDescription: "Application requests access to the device's camera." },
        { NSMicrophoneUsageDescription: "Application requests access to the device's microphone." },
        {
          NSDocumentsFolderUsageDescription:
            "Application requests access to the user's Documents folder."
        },
        {
          NSDownloadsFolderUsageDescription:
            "Application requests access to the user's Downloads folder."
        }
      ],
      notarize: false
    },
    dmg: {
      artifactName: '${name}-${version}.${ext}'
    },
    linux: {
      // 图标：linux 需要 png（build/icon/app.png），不能复用 win 的 ico
      icon: 'build/icon/app.png',
      target: ['AppImage', 'deb'],
      maintainer: 'electronjs.org',
      category: 'Utility',
      executableName: 'moechat',
      // Linux 产物名显式带 linux 标识，避免与 Windows 同名产物混淆
      artifactName: '${name}-${version}-linux.${ext}'
    },
    npmRebuild: false,
    publish: {
      provider: 'generic',
      url: 'https://example.com/auto-updates'
    },
    electronDownload: {
      mirror: 'https://npmmirror.com/mirrors/electron/'
    }
  }

  return isLinuxBuild
    ? {
        // Linux：AppImage + deb 安装包
        ...base,
        linux: {
          ...base.linux,
          target: ['AppImage', 'deb']
        }
      }
    : {
        // Windows：NSIS 安装包
        ...base,
        win: { ...base.win, target: ['nsis'] },
        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          // 自定义 NSIS 脚本：升级/卸载时保留 exe 同级 appData/（模型数据），
          // 安装和升级时保留同级 appData 目录。
          include: 'build/nsis/preserve-app-data.nsh',
          artifactName: '${name}-${version}-setup.${ext}',
          shortcutName: '${productName}',
          uninstallDisplayName: '${productName}',
          createDesktopShortcut: 'always',
          createStartMenuShortcut: true,
          installerIcon: 'build/icon/app.ico'
        }
      }
}
