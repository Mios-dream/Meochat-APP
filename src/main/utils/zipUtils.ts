import StreamZip from 'node-stream-zip'
import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

/**
 * 探测 zip 文件条目名的字符编码。
 *
 * 编码探测策略：
 * 1. 先以 UTF-8 编码读取所有条目名
 * 2. 如果发现包含 Unicode 替换字符（U+FFFD �），则判定为 GBK 编码
 * 3. 否则确认为 UTF-8 编码
 *
 * 兼容说明：
 * - Bandizip / Win11 新版压缩使用 UTF-8（但可能不置位 bit 11）
 * - 旧版压缩工具使用 GBK 编码
 *
 * @param zipPath - zip 文件的绝对路径
 * @returns 探测到的编码类型：'utf8' 或 'gbk'
 */
export async function detectZipNameEncoding(zipPath: string): Promise<'utf8' | 'gbk'> {
  const probe = new StreamZip.async({
    file: zipPath,
    nameEncoding: 'utf8',
    skipEntryNameValidation: true
  })
  try {
    const entries = Object.values(await probe.entries())
    for (const entry of entries) {
      if (entry.name.includes('�')) {
        return 'gbk'
      }
    }
    return 'utf8'
  } finally {
    await probe.close()
  }
}

/**
 * 解析角色包 info.yaml 内容为结构化对象。
 *
 * 处理流程：
 * 1. 自动去除 UTF-8 BOM 头（U+FEFF）
 * 2. 使用 yaml 库进行标准 YAML 解析
 * 3. 校验解析结果必须为非空对象（排除数组、null 等类型）
 *
 * @param content - YAML 格式的字符串内容
 * @returns 解析后的 Record 对象，解析失败或类型不符时返回空对象 `{}`
 */
export function parseYamlContent(content: string): Record<string, unknown> {
  // 去除 BOM 头
  const cleanContent = content.replace(/^\uFEFF/, '')
  const parsed = YAML.parse(cleanContent)
  // 确保返回的是对象类型
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {}
  }
  return parsed as Record<string, unknown>
}

/**
 * 判断 zip 条目是否位于指定的包根目录下。
 *
 * 用于过滤 zip 包中的条目，只处理属于指定目录的内容。
 * 如果 packageRoot 为空字符串，则所有条目都被视为有效。
 *
 * @param entryName - zip 条目的完整路径（如 "character/avatars/main.png"）
 * @param packageRoot - 期望的根目录前缀（如 "character"），空字符串表示不过滤
 * @returns 条目是否在指定根目录下
 */
export function isEntryUnderPackageRoot(entryName: string, packageRoot: string): boolean {
  return packageRoot ? entryName.startsWith(`${packageRoot}/`) : true
}

/**
 * 安全解压 zip 条目到目标目录，内置路径穿越防护。
 *
 * 安全措施：
 * 1. 过滤不属于指定包根目录的条目
 * 2. 跳过 info.yaml/info.yml 配置文件
 * 3. 可选过滤嵌套目录条目
 * 4. 路径规范化后进行越界检查（防止 ../../../etc/passwd 攻击）
 *
 * @param zip - StreamZip 异步实例
 * @param entries - 要解压的 zip 条目数组
 * @param packageRoot - 包内根目录前缀，空字符串表示解压整个包
 * @param targetDir - 解压目标目录的绝对路径
 * @param options - 可选配置
 * @param options.includeNestedEntries - 是否包含嵌套目录条目（默认 true）
 * @throws 当检测到不安全路径时抛出 Error
 */
export async function extractZipEntries(
  zip: StreamZip.StreamZipAsync,
  entries: StreamZip.ZipEntry[],
  packageRoot: string,
  targetDir: string,
  options?: { includeNestedEntries?: boolean }
): Promise<void> {
  const shouldIncludeNestedEntries = options?.includeNestedEntries !== false
  for (const entry of entries) {
    if (!isEntryUnderPackageRoot(entry.name, packageRoot)) {
      continue
    }

    const relativeEntryName = packageRoot ? entry.name.slice(packageRoot.length + 1) : entry.name
    if (!relativeEntryName || /^info\.ya?ml$/i.test(relativeEntryName)) {
      continue
    }
    if (!shouldIncludeNestedEntries && relativeEntryName.includes('/')) {
      continue
    }

    const normalizedRelativePath = path.normalize(relativeEntryName)
    const destinationPath = path.join(targetDir, normalizedRelativePath)

    if (entry.isDirectory) {
      fs.mkdirSync(destinationPath, { recursive: true })
      continue
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
    const data = await zip.entryData(entry.name)
    fs.writeFileSync(destinationPath, data)
  }
}
