/**
 * electron-builder 构建配置
 *
 * 本项目支持三种发布变体，通过环境变量 MOECHAT_VARIANT 在【构建时】选择，
 * 而不是靠手动搬移 resources/kernel-assets 目录内容来切换（避免来回挪动 2GB 数据包）：
 *
 * - lite（默认）：
 *   仅包含精简内核资产包（moechat-assets-*-lite.zip，无 wheels/数据），
 *   依赖与模型由首次运行在线安装，产物为 NSIS 安装包，体积 < 2GB，适用于 GitHub Release。
 * - cpu：
 *   包含 CPU wheels（moechat-assets-*-cpu.zip）+ 数据包（moechat-data-*.zip），
 *   离线开箱即用；但整体体积 > 2GB，超出 NSIS 的 ~2GB 硬上限。
 * - cuda：
 *   包含 CUDA 12.13 wheels（moechat-assets-*-cu130.zip）+ 数据包，同样 > 2GB。
 *   注意：electron-builder 的 portable 便携包目标同样基于 NSIS（NsisTarget，
 *   模板 portable.nsi），因此 >2GB 时同样会失败，唯一可行的产物是纯 zip 归档
 *   （由 7za 生成，支持 zip64，无 2GB 限制），用户解压后直接运行 moechat.exe。
 *
 * 一键构建（推荐）：scripts/build-all.ps1 自动完成"准备资源 + 打包"，可选任意变体组合。
 *
 * 配套 npm scripts（Windows）：
 *   .\scripts\build-all.ps1 -KernelSource <后端dist目录>   # 一键构建全部三个变体（也可加 -Lite/-Cpu/-Cuda 开关选变体）
 *   npm run build:win                # lite，等同 build:win:lite
 *   npm run build:win:lite           # 精简版：NSIS 安装包
 *   npm run build:win:cpu            # cpu 版：zip（需先 prepare-kernel-assets.ps1 -Variant cpu -IncludeData）
 *   npm run build:win:cuda           # cuda 版：zip（需先 prepare-kernel-assets.ps1 -Variant cu130 -IncludeData）
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

/** 支持的发布变体 */
const VARIANTS = ['lite', 'cpu', 'cuda'] as const

/** 发布变体类型 */
type Variant = (typeof VARIANTS)[number]

/** 当前配置文件所在目录（即项目根目录） */
const projectRoot = dirname(fileURLToPath(import.meta.url))

/**
 * 各发布变体对应的内核资产包 wheels 后缀，用于构建前校验资源包与变体是否匹配。
 * cuda 变体的后端产物后缀为 cu130（CUDA 12.13），故映射为 cu130；
 * lite 无 wheels，仅匹配精简源码包后缀 lite。
 */
const VARIANT_ASSET_SUFFIX: Record<Variant, string> = {
  lite: 'lite',
  cpu: 'cpu',
  cuda: 'cu130'
}

/**
 * 解析本次构建的发布变体。
 * 环境变量 MOECHAT_VARIANT 非法时抛出明确错误，避免静默降级导致打包出错误版本。
 * @returns 发布变体
 */
function resolveVariant(): Variant {
  const variant = (process.env.MOECHAT_VARIANT || 'lite').toLowerCase()
  if (!VARIANTS.includes(variant as Variant)) {
    throw new Error(
      `MOECHAT_VARIANT 取值非法: "${variant}"，仅支持 ${VARIANTS.join(' / ')}。` +
        '单变体请使用 npm run build:win:cpu / build:win:cuda，或一键构建 .\\scripts\\build-all.ps1。'
    )
  }
  return variant as Variant
}

/**
 * 校验指定变体构建的前置条件：resources/kernel-assets 中必须存在与该变体匹配的
 * 内核资产包（cpu → moechat-assets-*-cpu.zip，cuda → moechat-assets-*-cu130.zip），
 * 离线变体（cpu/cuda）还必须包含数据包（moechat-data-*.zip）。
 * @param variant 本次构建的发布变体
 */
function assertAssetsReady(variant: Variant): void {
  const assetsDir = join(projectRoot, 'resources', 'kernel-assets')
  if (!existsSync(assetsDir)) return
  const fileNames = readdirSync(assetsDir)

  // 任意变体都必须存在内核资产包
  const hasAssets = fileNames.some(
    (name) => name.startsWith('moechat-assets-') && name.endsWith('.zip')
  )
  if (!hasAssets) {
    throw new Error(
      'resources/kernel-assets 缺少内核资产包(moechat-assets-*.zip)。请先执行：\n' +
        '  .\\scripts\\prepare-kernel-assets.ps1 -KernelSource <后端dist目录>'
    )
  }

  // 离线变体（cpu/cuda）必须匹配对应 wheels 后缀，且携带数据包
  if (variant !== 'lite') {
    const suffix = VARIANT_ASSET_SUFFIX[variant]
    const hasVariantAssets = fileNames.some(
      (name) => name.startsWith('moechat-assets-') && name.endsWith(`-${suffix}.zip`)
    )
    if (!hasVariantAssets) {
      throw new Error(
        `构建变体 [${variant}] 需要 ${suffix} wheels 资产包(moechat-assets-*-${suffix}.zip)，` +
          '但当前 resources/kernel-assets 中资源不符。请先执行：\n' +
          `  .\\scripts\\prepare-kernel-assets.ps1 -KernelSource <后端dist目录> -Variant ${suffix} -IncludeData`
      )
    }
    const hasData = fileNames.some(
      (name) => name.startsWith('moechat-data-') && name.endsWith('.zip')
    )
    if (!hasData) {
      throw new Error(
        `构建变体 [${variant}] 缺少数据包(moechat-data-*.zip)。请先执行：\n` +
          `  .\\scripts\\prepare-kernel-assets.ps1 -KernelSource <后端dist目录> -Variant ${suffix} -IncludeData`
      )
    }
  }
}

/**
 * electron-builder 配置工厂（函数式导出，electron-builder 自动探测并调用）。
 * @returns 完整构建配置
 */
export default function electronBuilderConfig(): Configuration {
  const variant = resolveVariant()
  const isLite = variant === 'lite'

  // 构建前置校验：资源包须与所选变体匹配（cpu/cuda 需带数据包）
  assertAssetsReady(variant)

  /** 公共配置：与平台/变体无关的基础项 */
  const base: Configuration = {
    appId: 'com.electron.app',
    productName: 'moechat',
    directories: {
      buildResources: 'build',
      // 按变体隔离产物目录，避免 lite/cpu/cuda 互相覆盖 win-unpacked 等中间产物
      output: `dist/${variant}`
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
      // electron-builder 只自动排除"当前输出目录"；输出目录随变体变化(如 dist/lite)时，
      // 旧 dist 目录会退化为普通文件被打进 app.asar 造成递归膨胀，必须始终排除
      '!dist/**'
    ],
    asarUnpack: ['resources/**'],
    extraResources: [
      { from: 'resources/python-runtime', to: 'python-runtime', filter: ['**/*'] },
      {
        from: 'resources/kernel-assets',
        to: 'kernel-assets',
        // lite：过滤掉数据包（模型由后端首次运行自动下载）；cpu/cuda：全量包含（离线可用）
        filter: isLite ? ['**/*', '!**/moechat-data-*.zip'] : ['**/*']
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
      target: ['AppImage', 'snap', 'deb'],
      maintainer: 'electronjs.org',
      category: 'Utility'
    },
    appImage: {
      artifactName: '${name}-${version}.${ext}'
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

  // 变体相关配置：lite 用 NSIS 安装包；cpu/cuda 用 zip 归档（NSIS/portable 均有 2GB 上限，装不下离线完整版）
  if (!isLite) {
    return {
      ...base,
      // cpu/cuda 仅产出 zip；产物名内嵌变体后缀（cpu/cuda），避免三个变体相互覆盖同名产物。
      // 其中 ${name}/${version}/${arch} 为 electron-builder 宏，${variant} 由本文件模板字面量插值。
      win: {
        ...base.win,
        target: ['zip'],
        artifactName: `\${name}-\${version}-${variant}-\${arch}.zip`
      }
    }
  }

  return {
    ...base,
    win: { ...base.win, target: ['nsis'] },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      // 自定义 NSIS 脚本：升级/卸载时保留 exe 同级 appData/（模型数据），
      // 支撑"便携完整版 + Lite 安装包就地升级"的升级路径
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
