import StreamZip from 'node-stream-zip'

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
async function detectZipNameEncoding(zipPath: string): Promise<'utf8' | 'gbk'> {
  const probe = new StreamZip.async({ file: zipPath, nameEncoding: 'utf8', skipEntryNameValidation: true })
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

export { detectZipNameEncoding }
