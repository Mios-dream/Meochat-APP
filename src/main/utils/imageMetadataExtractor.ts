/**
 * 从图片文件中读取并提取隐藏的base64编码信息
 * 支持从图片的元数据或注释中提取信息
 */
class ImageMetadataExtractor {
  /**
   * 从JPEG文件中提取注释(COM段)中的隐藏信息
   * @param imageData 图片数据缓冲区
   * @returns string | null 提取的信息或null
   */
  private extractFromJPEG(imageData: Buffer): string | null {
    let i = 0

    // 检查JPEG文件头
    if (imageData.readUInt16BE(i) !== 0xffd8) {
      return null
    }
    i += 2

    // 遍历JPEG标记段
    while (i < imageData.length - 1) {
      const marker = imageData.readUInt16BE(i)

      // COM (Comment) 段: 0xFFFE
      if (marker === 0xfffe) {
        i += 2
        const segmentLength = imageData.readUInt16BE(i)
        i += 2

        // 提取注释内容
        const comment = imageData.toString('utf8', i, i + segmentLength - 2)
        return comment
      }

      // 跳过其他段
      if (marker >= 0xffc0 && marker <= 0xfffe) {
        i += 2
        const segmentLength = imageData.readUInt16BE(i)
        i += segmentLength
      } else {
        i++
      }
    }

    return null
  }

  /**
   * 从PNG文件中提取iTXt、tEXt或zTXt块中的隐藏信息
   * @param imageData 图片数据缓冲区
   * @returns string | null 提取的信息或null
   */
  private extractFromPNG(imageData: Buffer): string | null {
    // 检查PNG文件头
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    if (!Buffer.from(Uint8Array.prototype.slice.call(imageData, 0, 8)).equals(pngSignature)) {
      return null
    }

    let offset = 8 // 跳过文件头

    // 遍历PNG块
    while (offset < imageData.length) {
      // 读取块长度
      const chunkLength = imageData.readUInt32BE(offset)
      offset += 4

      // 读取块类型
      const chunkType = Buffer.from(
        Uint8Array.prototype.slice.call(imageData, offset, offset + 4)
      ).toString('ascii')
      offset += 4

      // 检查是否为文本相关块
      if (['tEXt', 'iTXt', 'zTXt'].includes(chunkType)) {
        // 提取块数据
        const chunkData = Buffer.from(
          Uint8Array.prototype.slice.call(imageData, offset, offset + chunkLength)
        )

        try {
          // 简单处理tEXt块，格式为: keyword + null + text
          const nullIndex = chunkData.indexOf(0x00)
          if (nullIndex !== -1 && nullIndex < chunkData.length - 1) {
            return chunkData.toString('utf8', nullIndex + 1)
          }
          return chunkData.toString('utf8')
        } catch (e) {
          console.error('解析PNG文本块时出错:', e)
        }
      }

      // 跳过块数据和CRC
      offset += chunkLength + 4
    }

    return null
  }

  /**
   * 尝试从图片数据中提取隐藏信息
   * @param imageData 图片数据缓冲区
   * @returns string | null 提取的信息或null
   */
  private extractHiddenInfo(imageData: Buffer): string | null {
    // 尝试从JPEG中提取
    let info = this.extractFromJPEG(imageData)
    if (info) return info

    // 尝试从PNG中提取
    info = this.extractFromPNG(imageData)
    if (info) return info

    // 可以根据需要添加其他图片格式的支持
    console.log('未在支持的元数据中找到隐藏信息，尝试从文件末尾查找')

    return null
  }

  /**
   * 检查字符串是否为有效的base64编码
   * @param str 要检查的字符串
   * @returns boolean 是否为有效的base64编码
   */
  private isBase64(str: string): boolean {
    // 移除空白字符并检查base64模式
    const base64Regex = /^[A-Za-z0-9+/=]+$/
    const trimmedStr = str.trim()

    // 检查base64格式
    if (!base64Regex.test(trimmedStr)) {
      return false
    }

    // 检查填充长度是否有效
    const paddingLength = (trimmedStr.match(/=*$/) || [''])[0].length
    if (paddingLength > 2) {
      return false
    }

    // 尝试解码以验证
    try {
      return Buffer.from(trimmedStr, 'base64').toString('base64') === trimmedStr
    } catch {
      return false
    }
  }

  /**
   * 解码base64字符串
   * @param base64Str base64编码的字符串
   * @returns string 解码后的字符串
   */
  private decodeBase64(base64Str: string): string {
    return Buffer.from(base64Str, 'base64').toString('utf8')
  }

  /**
   * 从图片文件中提取并解码隐藏的base64信息
   * @param imagePath 图片文件路径
   * @returns string 解码后的隐藏信息
   */
  public extractAndDecodeHiddenInfo(imageData: Buffer): string {
    try {
      // 提取隐藏信息
      const hiddenInfo = this.extractHiddenInfo(imageData)

      if (!hiddenInfo) {
        throw new Error('未找到隐藏信息')
      }

      // 检查是否为base64编码
      if (this.isBase64(hiddenInfo)) {
        // 解码base64信息
        const decodedInfo = this.decodeBase64(hiddenInfo)
        return decodedInfo
      } else {
        // 在提取的信息中查找可能的base64子串
        const base64Regex = /[A-Za-z0-9+/]{40,}={0,2}/g
        const matches = hiddenInfo.match(base64Regex)

        if (matches && matches.length > 0) {
          // 尝试解码第一个找到的较长的base64字符串
          for (const match of matches) {
            if (this.isBase64(match)) {
              const decodedInfo = this.decodeBase64(match)

              return decodedInfo
            }
          }
        }

        throw new Error('找到的信息不是有效的base64编码')
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('处理图片时发生未知错误')
    }
  }

  /**
   * 备选方案：直接在整个文件中搜索base64编码
   * @param imagePath 图片文件路径
   * @returns Promise<string> 找到并解码的base64信息
   */
  async findBase64InFile(imageData: Buffer): Promise<string> {
    // 尝试使用正则表达式查找可能的base64编码
    const base64Regex = /[A-Za-z0-9+/]{40,}={0,2}/g
    const fileStr = imageData.toString('binary')
    const matches = fileStr.match(base64Regex)

    if (matches && matches.length > 0) {
      // 尝试解码找到的base64字符串
      for (const match of matches) {
        try {
          if (this.isBase64(match)) {
            const decoded = this.decodeBase64(match)
            // 检查解码结果是否包含有意义的文本
            if (/[a-zA-Z]{5,}/.test(decoded)) {
              return decoded
            }
          }
        } catch {
          // 忽略解码失败的匹配
        }
      }
    }

    throw new Error('在文件中未找到有效的base64编码信息')
  }
}

export default ImageMetadataExtractor
